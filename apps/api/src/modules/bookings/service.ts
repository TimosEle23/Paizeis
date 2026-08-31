import mongoose, { Types } from "mongoose";
import type { BookingDto, CreateBookingInput } from "@paizeis/shared";
import { BLOCKING_BOOKING_STATUSES, BOOKING_HOLD_MINUTES, CURRENCY } from "@paizeis/shared";
import { ApiError } from "../../lib/errors.js";
import { toObjectId } from "../../lib/tokens.js";
import { BookingModel, PitchBlockModel, TeamModel, VenueModel, type BookingDoc } from "../../models/index.js";
import type { Actor } from "../../types/express.js";
import { supportsTransactions } from "../../db/mongo.js";
import { assertCanModifyBooking, assertCanViewBooking, assertOnTeam } from "./policies.js";

export function toBookingDto(booking: BookingDoc | Record<string, any>): BookingDto {
  const b = booking as Record<string, any>;
  return {
    id: String(b._id),
    venueId: String(b.venueId),
    venueName: b.venueName,
    pitchId: String(b.pitchId),
    pitchName: b.pitchName,
    pitchType: b.pitchType,
    teamId: String(b.teamId),
    teamName: b.teamName ?? "",
    userId: String(b.userId),
    startsAt: new Date(b.startsAt).toISOString(),
    endsAt: new Date(b.endsAt).toISOString(),
    durationHours: b.durationHours,
    totalAmount: b.totalAmount,
    depositAmount: b.depositAmount,
    currency: b.currency ?? CURRENCY,
    status: b.status,
    players: b.players ?? [],
    holdExpiresAt: b.holdExpiresAt ? new Date(b.holdExpiresAt).toISOString() : null,
    createdAt: new Date(b.createdAt).toISOString(),
  };
}

/**
 * Creates a booking, or fails because the slot is gone.
 *
 * Three things have to be true at once, and they are why this runs inside a
 * transaction rather than as a sequence of checks:
 *
 *   1. No active booking overlaps this pitch and interval. The unique index on
 *      (pitchId, startsAt) catches identical starts on its own, but a
 *      17:30–19:00 booking conflicts with 18:00–19:00 while having a different
 *      start — only a range query finds that.
 *   2. No maintenance block overlaps it.
 *   3. Price and deposit are computed here, from the venue's own numbers. A
 *      client never names its price.
 *
 * Between the availability call that drew the screen and this call, someone
 * else may have taken the slot. That race is the normal case on a Saturday
 * evening, not an edge case, and 409 SLOT_TAKEN is its correct answer.
 */
export async function createBooking(actor: Actor, input: CreateBookingInput): Promise<BookingDto> {
  const pitchId = toObjectId(input.pitchId);
  const teamId = toObjectId(input.teamId);

  await assertOnTeam(actor, teamId);

  const venue = await VenueModel.findOne({ "pitches._id": pitchId }).lean();
  if (!venue) throw ApiError.notFound("Pitch not found");

  const pitch = (venue.pitches ?? []).find((p: Record<string, any>) => String(p._id) === input.pitchId);
  if (!pitch || pitch.isAvailable === false) throw ApiError.notFound("Pitch not found");

  const team = await TeamModel.findById(teamId).lean();
  if (!team) throw ApiError.notFound("Team not found");

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + input.duration * 3600_000);

  if (startsAt.getTime() < Date.now()) {
    throw ApiError.badRequest("That time has already passed");
  }

  const totalAmount = round2(pitch.pricePerHour * input.duration);
  const depositAmount = round2(totalAmount * (venue.depositRate ?? 0.2));

  const document = {
    venueId: venue._id,
    pitchId,
    teamId,
    userId: actor.id,
    venueName: venue.name,
    pitchName: pitch.name,
    pitchType: pitch.pitchType,
    startsAt,
    endsAt,
    durationHours: input.duration,
    totalAmount,
    depositAmount,
    currency: CURRENCY,
    status: "held" as const,
    players: input.players,
    holdExpiresAt: new Date(Date.now() + BOOKING_HOLD_MINUTES * 60_000),
  };

  const created = await withOptionalTransaction(async (session) => {
    const conflict = await BookingModel.exists({
      pitchId,
      status: { $in: [...BLOCKING_BOOKING_STATUSES] },
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
    }).session(session ?? null);
    if (conflict) throw ApiError.slotTaken();

    const blocked = await PitchBlockModel.exists({
      pitchId,
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
    }).session(session ?? null);
    if (blocked) throw ApiError.slotTaken("That pitch is closed for maintenance then");

    const [booking] = await BookingModel.create([document], session ? { session } : {});
    return booking!;
  });

  return { ...toBookingDto(created), teamName: team.name };
}

export async function getBooking(actor: Actor, id: string): Promise<BookingDto> {
  const booking = await BookingModel.findById(toObjectId(id)).lean();
  if (!booking) throw ApiError.notFound("Booking not found");

  await assertCanViewBooking(actor, booking);

  const team = await TeamModel.findById(booking.teamId).select("name").lean();
  return { ...toBookingDto(booking), teamName: team?.name ?? "" };
}

/** The caller's own bookings, newest first. */
export async function listMyBookings(actor: Actor): Promise<BookingDto[]> {
  const bookings = await BookingModel.find({ userId: actor.id }).sort({ startsAt: -1 }).limit(100).lean();
  const teams = await TeamModel.find({ _id: { $in: bookings.map((b) => b.teamId) } }).select("name").lean();
  const names = new Map(teams.map((t) => [String(t._id), t.name]));

  return bookings.map((b) => ({ ...toBookingDto(b), teamName: names.get(String(b.teamId)) ?? "" }));
}

export async function cancelBooking(actor: Actor, id: string, reason?: string): Promise<BookingDto> {
  const booking = await BookingModel.findById(toObjectId(id));
  if (!booking) throw ApiError.notFound("Booking not found");

  await assertCanModifyBooking(actor, booking);

  if (booking.status === "cancelled") return toBookingDto(booking);
  if (booking.startsAt.getTime() < Date.now()) {
    throw ApiError.conflict("That match has already been played");
  }

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  booking.cancellationReason = reason ?? null;
  // Releases the slot: the unique index only covers active statuses.
  booking.holdExpiresAt = null;
  await booking.save();

  return toBookingDto(booking);
}

/**
 * Runs the work in a transaction where the deployment supports one.
 *
 * Atlas and the test replica set do. A bare standalone mongod does not, and
 * rather than refuse to run at all, this falls back to the unique index as the
 * remaining guarantee — which still catches identical-start collisions, the
 * common case. The startup log warns when that is what is happening.
 */
async function withOptionalTransaction<T>(work: (session: mongoose.ClientSession | null) => Promise<T>): Promise<T> {
  if (!supportsTransactions()) return work(null);

  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

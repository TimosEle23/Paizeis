import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { VENUE_TIMEZONE } from "@paizeis/shared";
import { ApiError } from "../../lib/errors.js";
import { toObjectId } from "../../lib/tokens.js";
import { pushToUser } from "../../lib/push.js";
import { BookingModel, InvitationModel, TeamModel, UserModel } from "../../models/index.js";
import type { Actor } from "../../types/express.js";

/** How long a match invitation stays open. */
const INVITATION_TTL_DAYS = 14;

export interface MatchInvitationDto {
  id: string;
  bookingId: string;
  venueName: string;
  pitchName: string;
  startsAt: string;
  teamName: string;
  invitedByName: string;
  email: string;
  status: "pending" | "accepted" | "declined";
  expiresAt: string;
}

function describe(startsAt: Date): string {
  return startsAt.toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
    timeZone: VENUE_TIMEZONE,
  });
}

/**
 * Invites someone to a specific match and buzzes their phone.
 *
 * Only people on the booking can invite: the person who booked, or a teammate.
 * That is the `email_invitations` RLS rule ("insert if you are the inviter")
 * expressed as a check the server actually performs.
 */
export async function inviteToBooking(
  actor: Actor,
  bookingId: string,
  email: string,
): Promise<MatchInvitationDto> {
  const booking = await BookingModel.findById(toObjectId(bookingId));
  if (!booking) throw ApiError.notFound("Booking not found");

  const onTeam = await TeamModel.exists({ _id: booking.teamId, "roster.userId": actor.id });
  if (!booking.userId.equals(actor.id) && !onTeam) {
    throw ApiError.forbidden("Only players on this booking can invite others");
  }

  if (booking.status === "cancelled" || booking.status === "expired") {
    throw ApiError.conflict("That match is no longer on");
  }

  const normalised = email.toLowerCase().trim();
  const inviter = await UserModel.findById(actor.id).select("fullName").lean();
  const invitee = await UserModel.findOne({ email: normalised }).select("_id fullName").lean();
  const team = await TeamModel.findById(booking.teamId).select("name").lean();

  if (invitee && new Types.ObjectId(invitee._id).equals(actor.id)) {
    throw ApiError.badRequest("You are already playing in this match");
  }

  const existing = await InvitationModel.findOne({
    bookingId: booking._id, email: normalised, acceptedAt: null,
  });
  if (existing) throw ApiError.conflict("They have already been invited to this match");

  const invitation = await InvitationModel.create({
    token: randomBytes(24).toString("base64url"),
    email: normalised,
    type: "booking",
    bookingId: booking._id,
    teamId: booking.teamId,
    invitedBy: actor.id,
    expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 3600_000),
  });

  // Add them to the team sheet straight away so the squad list is right; the
  // invitation tracks whether they have actually said yes.
  if (!booking.players.includes(normalised)) {
    booking.players.push(normalised);
    await booking.save();
  }

  if (invitee) {
    await pushToUser(new Types.ObjectId(invitee._id), {
      title: `${inviter?.fullName ?? "Someone"} invited you to play`,
      body: `${booking.venueName} · ${describe(booking.startsAt)}`,
      data: { type: "booking-invitation", invitationId: invitation.id, bookingId: booking.id },
    });
  }

  return {
    id: invitation.id,
    bookingId: booking.id,
    venueName: booking.venueName,
    pitchName: booking.pitchName,
    startsAt: booking.startsAt.toISOString(),
    teamName: team?.name ?? "",
    invitedByName: inviter?.fullName ?? "",
    email: normalised,
    status: "pending",
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

/** Invitations addressed to the caller's email, newest match first. */
export async function listMyInvitations(actor: Actor): Promise<MatchInvitationDto[]> {
  const user = await UserModel.findById(actor.id).select("email").lean();
  if (!user) throw ApiError.unauthenticated();

  const invitations = await InvitationModel.find({ email: user.email, type: "booking" })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const bookings = await BookingModel.find({ _id: { $in: invitations.map((i) => i.bookingId) } }).lean();
  const byId = new Map(bookings.map((b) => [String(b._id), b]));

  const inviters = await UserModel.find({ _id: { $in: invitations.map((i) => i.invitedBy) } })
    .select("fullName").lean();
  const inviterById = new Map(inviters.map((u) => [String(u._id), u.fullName]));

  return invitations.flatMap((invitation) => {
    const booking = byId.get(String(invitation.bookingId));
    if (!booking) return [];
    return [{
      id: String(invitation._id),
      bookingId: String(booking._id),
      venueName: booking.venueName,
      pitchName: booking.pitchName,
      startsAt: booking.startsAt.toISOString(),
      teamName: "",
      invitedByName: inviterById.get(String(invitation.invitedBy)) ?? "",
      email: invitation.email,
      status: invitation.acceptedAt ? "accepted" as const : "pending" as const,
      expiresAt: invitation.expiresAt.toISOString(),
    }];
  });
}

/**
 * Accept or decline. Accepting puts the player on the team roster so they turn
 * up in the squad; declining takes them off the match sheet.
 */
export async function respondToInvitation(
  actor: Actor,
  invitationId: string,
  accept: boolean,
): Promise<{ status: "accepted" | "declined" }> {
  const invitation = await InvitationModel.findById(toObjectId(invitationId));
  if (!invitation) throw ApiError.notFound("Invitation not found");

  const user = await UserModel.findById(actor.id).select("email fullName").lean();
  // 404 rather than 403: an invitation addressed to someone else is not the
  // caller's business to know about.
  if (!user || user.email !== invitation.email) throw ApiError.notFound("Invitation not found");

  const booking = await BookingModel.findById(invitation.bookingId);
  if (!booking) throw ApiError.notFound("That match no longer exists");

  if (accept) {
    invitation.acceptedAt = new Date();
    await invitation.save();

    await TeamModel.updateOne(
      { _id: booking.teamId, "roster.userId": { $ne: actor.id } },
      { $push: { roster: { userId: actor.id, status: "accepted", joinedAt: new Date() } } },
    );

    await pushToUser(booking.userId, {
      title: `${user.fullName} is in`,
      body: `${booking.venueName} · ${describe(booking.startsAt)}`,
      data: { type: "invitation-accepted", bookingId: booking.id },
    });

    return { status: "accepted" };
  }

  booking.players = booking.players.filter((player) => player !== invitation.email);
  await booking.save();
  await invitation.deleteOne();

  await pushToUser(booking.userId, {
    title: `${user.fullName} can't make it`,
    body: `${booking.venueName} · ${describe(booking.startsAt)}`,
    data: { type: "invitation-declined", bookingId: booking.id },
  });

  return { status: "declined" };
}

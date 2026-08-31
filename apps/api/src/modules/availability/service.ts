import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { AvailabilityDto, AvailabilityQuery, SlotDto } from "@paizeis/shared";
import {
  BLOCKING_BOOKING_STATUSES, DEFAULT_OPENING_HOURS, SLOT_STEP_MINUTES, VENUE_TIMEZONE,
} from "@paizeis/shared";
import { ApiError } from "../../lib/errors.js";
import { toObjectId } from "../../lib/tokens.js";
import { BookingModel, PitchBlockModel, VenueModel } from "../../models/index.js";
import { toPitchDto } from "../venues/mapper.js";

/**
 * Real availability for one venue on one day.
 *
 * This replaces the web app's `generateTimeSlots`, which produced slots from a
 * hardcoded `unavailableHours = [11, 13, 16, 20]` and never consulted the
 * bookings table — every venue showed the same four "busy" hours, and nothing
 * stopped two people booking the same pitch.
 *
 * A slot is available when all of these hold:
 *   · it fits inside the venue's opening hours, in Cyprus local time
 *   · it does not overlap an active booking on that pitch
 *   · it does not overlap a maintenance block
 *   · it has not already started
 */
export async function getAvailability(venueId: string, query: AvailabilityQuery): Promise<AvailabilityDto> {
  const venue = await VenueModel.findById(toObjectId(venueId)).lean();
  if (!venue) throw ApiError.notFound("Venue not found");

  const hours = venue.openingHours ?? { ...DEFAULT_OPENING_HOURS };
  const dayStart = fromZonedTime(`${query.date}T${pad(hours.open)}`, VENUE_TIMEZONE);
  let dayEnd = fromZonedTime(`${query.date}T${pad(hours.close)}`, VENUE_TIMEZONE);
  // A venue closing at or after midnight closes on the following day.
  if (dayEnd <= dayStart) dayEnd = new Date(dayEnd.getTime() + 24 * 3600_000);

  const pitches = (venue.pitches ?? []).filter((pitch: Record<string, any>) => {
    if (pitch.isAvailable === false) return false;
    if (query.pitchId && String(pitch._id) !== query.pitchId) return false;
    if (query.pitchType && pitch.pitchType !== query.pitchType) return false;
    return true;
  });

  const pitchIds = pitches.map((pitch: Record<string, any>) => pitch._id);

  // One query each for the whole day across all pitches, rather than per slot.
  const [bookings, blocks] = await Promise.all([
    BookingModel.find({
      pitchId: { $in: pitchIds },
      status: { $in: [...BLOCKING_BOOKING_STATUSES] },
      startsAt: { $lt: dayEnd },
      endsAt: { $gt: dayStart },
    }).select("pitchId startsAt endsAt").lean(),
    PitchBlockModel.find({
      pitchId: { $in: pitchIds },
      startsAt: { $lt: dayEnd },
      endsAt: { $gt: dayStart },
    }).select("pitchId startsAt endsAt").lean(),
  ]);

  const now = new Date();
  const durationMs = query.duration * 3600_000;
  const stepMs = SLOT_STEP_MINUTES * 60_000;

  return {
    venueId: String(venue._id),
    date: query.date,
    durationHours: query.duration,
    timezone: VENUE_TIMEZONE,
    pitches: pitches.map((pitch: Record<string, any>) => {
      const taken = bookings.filter((b) => String(b.pitchId) === String(pitch._id));
      const blocked = blocks.filter((b) => String(b.pitchId) === String(pitch._id));
      const slots: SlotDto[] = [];

      for (let start = dayStart.getTime(); start + durationMs <= dayEnd.getTime(); start += stepMs) {
        const startsAt = new Date(start);
        const endsAt = new Date(start + durationMs);

        let reason: SlotDto["reason"] | undefined;
        if (endsAt <= now) reason = "past";
        else if (taken.some((b) => overlaps(startsAt, endsAt, b.startsAt, b.endsAt))) reason = "booked";
        else if (blocked.some((b) => overlaps(startsAt, endsAt, b.startsAt, b.endsAt))) reason = "blocked";

        slots.push({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          available: reason === undefined,
          ...(reason ? { reason } : {}),
          pricePerSlot: round2(pitch.pricePerHour * query.duration),
        });
      }

      return { pitch: toPitchDto(pitch), slots };
    }),
  };
}

/**
 * Half-open interval overlap: [aStart, aEnd) against [bStart, bEnd).
 *
 * Half-open is what makes back-to-back bookings work — an 18:00–19:00 booking
 * must not block 19:00–20:00. Using closed intervals here would lose a venue a
 * slot between every pair of matches.
 */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function pad(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Kept for callers that only need the day bounds, e.g. the venue-manager view. */
export function venueDayBounds(date: string, open: string, close: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = fromZonedTime(`${date}T${pad(open)}`, VENUE_TIMEZONE);
  let dayEnd = fromZonedTime(`${date}T${pad(close)}`, VENUE_TIMEZONE);
  if (dayEnd <= dayStart) dayEnd = new Date(dayEnd.getTime() + 24 * 3600_000);
  return { dayStart, dayEnd };
}

/** Formats an instant in the venue's timezone, for emails and push copy. */
export function inVenueTime(instant: Date): Date {
  return toZonedTime(instant, VENUE_TIMEZONE);
}

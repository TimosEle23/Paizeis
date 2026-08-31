import { z } from "zod";
import { DURATION_OPTIONS, PITCH_TYPES } from "../constants";
import { isoDate, objectId } from "./common";

const durationHours = z
  .coerce
  .number()
  .refine((v): v is (typeof DURATION_OPTIONS)[number] => (DURATION_OPTIONS as readonly number[]).includes(v), {
    message: `Duration must be one of ${DURATION_OPTIONS.join(", ")} hours`,
  });

/**
 * Availability for one venue on one day. Replaces the hardcoded
 * `unavailableHours = [11, 13, 16, 20]` the web booking page used to fake.
 */
export const availabilityQuerySchema = z.object({
  date: isoDate,
  pitchType: z.enum(PITCH_TYPES).optional(),
  pitchId: objectId.optional(),
  duration: durationHours.default(1),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

/**
 * Creating a booking sends only what the server cannot derive. Price, deposit
 * and end time are computed server-side — a client must never name its price.
 */
export const createBookingSchema = z.object({
  pitchId: objectId,
  teamId: objectId,
  /** Slot start, ISO 8601 with offset or Z. */
  startsAt: z.string().datetime({ offset: true }),
  duration: durationHours,
  /** Emails or names of players on the sheet; emails get an invitation. */
  players: z.array(z.string().trim().min(1).max(255)).max(20).default([]),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

/** Maintenance window, replacing the old "blocked" fake-booking rows. */
export const createBlockSchema = z.object({
  pitchId: objectId,
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().max(200).optional(),
});
export type CreateBlockInput = z.infer<typeof createBlockSchema>;

export const bookingListQuerySchema = z.object({
  status: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  venueId: objectId.optional(),
});
export type BookingListQuery = z.infer<typeof bookingListQuerySchema>;

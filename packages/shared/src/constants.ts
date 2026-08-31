/**
 * Cross-cutting constants. Anything a client and the server must agree on lives
 * here so the two can never drift — the deposit-rate mismatch in the original
 * web app (stored 15%, displayed 20%) came from having the number in two places.
 */

/** All venues are in Cyprus; slot maths converts UTC to this zone. */
export const VENUE_TIMEZONE = "Europe/Nicosia";

/**
 * `padel` is the correct spelling. The Supabase data stored it as "paddle";
 * the migration normalises it, so "paddle" exists nowhere past that boundary.
 */
export const PITCH_TYPES = ["5v5", "7v7", "9v9", "11v11", "futsal", "padel"] as const;
export type PitchType = (typeof PITCH_TYPES)[number];

/** Groups used by the venue filters on web and in the app. */
export const SPORT_CATEGORIES = ["football", "padel"] as const;
export type SportCategory = (typeof SPORT_CATEGORIES)[number];

export const PITCH_TYPES_BY_CATEGORY: Record<SportCategory, readonly PitchType[]> = {
  football: ["5v5", "7v7", "9v9", "11v11", "futsal"],
  padel: ["padel"],
};

/**
 * Cities with venues today, for filter chips. Deliberately NOT a validation
 * enum — a venue in a town not on this list must not make the venues endpoint
 * reject the request. Order is by venue count.
 */
export const CYPRUS_CITIES = [
  "Limassol",
  "Nicosia",
  "Larnaca",
  "Paphos",
  "Famagusta",
  "Ayia Napa",
] as const;

export const ROLES = ["user", "venueManager", "admin"] as const;
export type Role = (typeof ROLES)[number];

/**
 * `held`      — slot reserved, deposit not yet paid; expires after BOOKING_HOLD_MINUTES
 * `confirmed` — deposit paid (set by the Stripe webhook)
 * `cancelled` — cancelled by player or venue
 * `expired`   — hold ran out before payment
 * `completed` — match played
 */
export const BOOKING_STATUSES = [
  "held",
  "confirmed",
  "cancelled",
  "payment_failed",
  "expired",
  "completed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that occupy a pitch and therefore remove a slot from availability. */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = ["held", "confirmed", "completed"];

/** Deposit taken up front, as a fraction of the total. Venues may override. */
export const DEFAULT_DEPOSIT_RATE = 0.2;

/** How long an unpaid booking keeps its slot before the TTL index reaps it. */
export const BOOKING_HOLD_MINUTES = 15;

/** Bookable durations, in hours. */
export const DURATION_OPTIONS = [1, 1.5, 2] as const;
export type DurationHours = (typeof DURATION_OPTIONS)[number];

/** Slots start on this grid, in minutes past the hour. */
export const SLOT_STEP_MINUTES = 30;

/** Squad cap carried over from the original booking flow. */
export const MAX_TEAM_PLAYERS = 7;

/** Fallback opening hours when a venue has not set its own. */
export const DEFAULT_OPENING_HOURS = { open: "09:00", close: "21:00" } as const;

export const CURRENCY = "EUR" as const;

import { fromZonedTime } from "date-fns-tz";
import { Types } from "mongoose";
import { BOOKING_HOLD_MINUTES, VENUE_TIMEZONE, type PitchType } from "@paizeis/shared";
import type { IdMap } from "./idmap.js";

/** Every row out of Postgres arrives as a loose object. */
export type Row = Record<string, any>;

/**
 * "paddle" is how the Supabase data spelled it. The correct spelling is padel,
 * and the shared contract uses that, so it is normalised here — at the only
 * boundary where the old spelling exists.
 */
export function normalisePitchType(value: string): PitchType {
  const lower = String(value).trim().toLowerCase();
  if (lower === "paddle" || lower === "padel") return "padel";
  if (["5v5", "7v7", "9v9", "11v11", "futsal"].includes(lower)) return lower as PitchType;
  // Anything unrecognised is treated as 5v5 rather than dropped — losing a
  // pitch silently would take its bookings down with it.
  return "5v5";
}

/**
 * Combines a `booking_date` ("2024-05-15") and a time ("18:00:00"), read as
 * Cyprus wall-clock time, into a UTC instant.
 *
 * The old schema could not express an interval and had no timezone, so a match
 * at 18:00 meant different instants either side of a DST changeover. Converting
 * here is the point at which that ambiguity is resolved for good.
 */
export function toUtc(date: string, time: string): Date {
  const hhmmss = time.length === 5 ? `${time}:00` : time;
  return fromZonedTime(`${date}T${hhmmss}`, VENUE_TIMEZONE);
}

/**
 * Maps a Supabase booking status onto the new set.
 *
 * "pending" meant "created, deposit not paid". Now that unpaid bookings hold a
 * slot for a fixed window, a historical pending booking whose match date has
 * passed is `expired` — it was never paid and never will be. Giving it `held`
 * would hand it a live TTL and delete the record outright.
 */
export function mapBookingStatus(source: string, startsAt: Date, now: Date) {
  if (source === "confirmed") return { status: "confirmed" as const, holdExpiresAt: null };
  if (source === "cancelled") return { status: "cancelled" as const, holdExpiresAt: null };
  if (source === "payment_failed") return { status: "payment_failed" as const, holdExpiresAt: null };

  if (startsAt.getTime() < now.getTime()) {
    return { status: "expired" as const, holdExpiresAt: null };
  }
  return {
    status: "held" as const,
    holdExpiresAt: new Date(now.getTime() + BOOKING_HOLD_MINUTES * 60_000),
  };
}

/** GeoJSON wants [longitude, latitude] — the reverse of how it is spoken. */
export function toGeoPoint(latitude: unknown, longitude: unknown) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return undefined;
  return { type: "Point" as const, coordinates: [longitude, latitude] };
}

export function optionalDate(value: unknown): Date | null {
  return typeof value === "string" && value ? new Date(value) : null;
}

export function objectIdOrNull(map: IdMap, table: string, uuid: unknown): Types.ObjectId | null {
  return typeof uuid === "string" ? map.optional(table, uuid) : null;
}

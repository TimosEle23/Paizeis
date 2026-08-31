import { z } from "zod";
import { PITCH_TYPES, SPORT_CATEGORIES } from "../constants";
import { objectId, timeOfDay } from "./common";

export const openingHoursSchema = z.object({
  open: timeOfDay,
  close: timeOfDay,
});
export type OpeningHours = z.infer<typeof openingHoursSchema>;

/** Query behind the Venues screen: search box, city chips, sport filters, near-me. */
export const venueQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  // Free text, not an enum: a new city must never 400 the venues list.
  city: z.string().trim().max(100).optional(),
  sport: z.enum(SPORT_CATEGORIES).optional(),
  pitchType: z.enum(PITCH_TYPES).optional(),
  /** "lat,lng" — sorts by distance from the device. */
  near: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, { message: "Expected lat,lng" })
    .optional(),
  radiusKm: z.coerce.number().min(1).max(200).default(50),
});
export type VenueQuery = z.infer<typeof venueQuerySchema>;

export const pitchInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  pitchType: z.enum(PITCH_TYPES),
  pricePerHour: z.number().min(0).max(10000),
  features: z.array(z.string().trim().max(60)).max(20).default([]),
  isAvailable: z.boolean().default(true),
});
export type PitchInput = z.infer<typeof pitchInputSchema>;

/** Admin venue create/update — ported from the web app's venueSchema. */
export const venueInputSchema = z.object({
  name: z.string().trim().min(1, { message: "Venue name is required" }).max(200),
  city: z.string().trim().min(1, { message: "City is required" }).max(100),
  location: z.string().trim().min(1, { message: "Location is required" }).max(500),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  website: z.string().trim().max(500).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(1000).optional().or(z.literal("")),
  futsalImageUrl: z.string().trim().max(1000).optional().or(z.literal("")),
  paddleImageUrl: z.string().trim().max(1000).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  googleRating: z.number().min(0).max(5).optional(),
  googleReviewsCount: z.number().int().min(0).optional(),
  bookingMethod: z.string().trim().max(100).optional().or(z.literal("")),
  openingHours: openingHoursSchema.optional(),
  depositRate: z.number().min(0).max(1).optional(),
});
export type VenueInput = z.infer<typeof venueInputSchema>;

export const assignVenueManagerSchema = z.object({
  userId: objectId,
  venueId: objectId,
});
export type AssignVenueManagerInput = z.infer<typeof assignVenueManagerSchema>;

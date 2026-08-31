import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { DEFAULT_DEPOSIT_RATE, DEFAULT_OPENING_HOURS, PITCH_TYPES } from "@paizeis/shared";

/**
 * Pitches are embedded rather than a collection of their own: a venue has a
 * handful of them, they are always loaded with the venue, and they are never
 * queried independently. Each keeps a stable `_id`, which bookings reference.
 */
const pitchSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    pitchType: { type: String, required: true, enum: PITCH_TYPES },
    pricePerHour: { type: Number, required: true, min: 0 },
    features: { type: [String], default: [] },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const venueSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    location: { type: String, required: true, trim: true, maxlength: 500 },

    /**
     * GeoJSON Point, [longitude, latitude] — that order, which is the reverse
     * of how humans say it and the most common source of "why is this venue in
     * the sea" bugs.
     */
    geo: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined },
    },

    phone: { type: String, default: null },
    website: { type: String, default: null },
    imageUrl: { type: String, default: null },
    futsalImageUrl: { type: String, default: null },
    paddleImageUrl: { type: String, default: null },

    googleRating: { type: Number, default: null, min: 0, max: 5 },
    googleReviewsCount: { type: Number, default: null, min: 0 },
    bookingMethod: { type: String, default: null },

    /** Venue-local wall clock. Slot generation reads these, not a hardcoded 9–21. */
    openingHours: {
      open: { type: String, default: DEFAULT_OPENING_HOURS.open },
      close: { type: String, default: DEFAULT_OPENING_HOURS.close },
    },

    /** Fraction of the total taken up front. One source of truth, server-side. */
    depositRate: { type: Number, default: DEFAULT_DEPOSIT_RATE, min: 0, max: 1 },

    pitches: { type: [pitchSchema], default: [] },
  },
  { timestamps: true },
);

// Powers the "closest to me" sort on the venues screen.
venueSchema.index({ "geo.coordinates": "2dsphere" });
venueSchema.index({ city: 1 });
venueSchema.index({ "pitches.pitchType": 1 });
// Backs the venue search box.
venueSchema.index({ name: "text", location: "text", city: "text" });

export type Venue = InferSchemaType<typeof venueSchema>;
export type VenueDoc = HydratedDocument<Venue>;
export const VenueModel = model("Venue", venueSchema);

import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { BLOCKING_BOOKING_STATUSES, BOOKING_STATUSES, CURRENCY, PITCH_TYPES } from "@paizeis/shared";

/**
 * A pitch reservation.
 *
 * Times are UTC `Date`s spanning a real interval. The Supabase schema stored a
 * `booking_date` column plus "HH:MM" strings, which cannot express an interval
 * and misbehaves across the two DST changeovers Cyprus has each year.
 *
 * Two mechanisms keep a pitch from being double-booked, and both are needed:
 *
 *   1. The partial unique index below rejects a second active booking with the
 *      same pitch and the same start instant, at the storage layer, no matter
 *      what the application does.
 *   2. Identical starts are only the easy collision. A 17:30–19:00 booking also
 *      conflicts with 18:00–19:00 while having a different start, so the create
 *      path runs an overlap query inside a transaction as well.
 *
 * The index is *partial* — restricted to statuses that actually occupy the
 * pitch. Without that, one cancelled booking would block its slot forever.
 */
const bookingSchema = new Schema(
  {
    venueId: { type: Schema.Types.ObjectId, ref: "Venue", required: true },
    /** _id of the embedded pitch subdocument on the venue. */
    pitchId: { type: Schema.Types.ObjectId, required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /**
     * Names captured at booking time. A venue rename must not silently rewrite
     * the history of what someone booked.
     */
    venueName: { type: String, required: true },
    pitchName: { type: String, required: true },
    pitchType: { type: String, required: true, enum: PITCH_TYPES },

    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    durationHours: { type: Number, required: true, min: 0.5, max: 6 },

    totalAmount: { type: Number, required: true, min: 0 },
    depositAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: CURRENCY },

    status: { type: String, required: true, enum: BOOKING_STATUSES, default: "held" },

    /** Names or emails on the team sheet for this match. */
    players: { type: [String], default: [] },

    /**
     * Set while the booking is `held`. A TTL index deletes the document when it
     * passes, so an abandoned checkout releases the pitch without anyone
     * intervening. Cleared when payment confirms.
     */
    holdExpiresAt: { type: Date, default: null },

    stripeSessionId: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: null },
  },
  { timestamps: true },
);

// (1) Storage-level guarantee against identical-start double booking.
bookingSchema.index(
  { pitchId: 1, startsAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: [...BLOCKING_BOOKING_STATUSES] } },
    name: "unique_active_slot",
  },
);

// Backs the overlap query in (2), and the venue-manager day view.
bookingSchema.index({ pitchId: 1, startsAt: 1, endsAt: 1 });
bookingSchema.index({ venueId: 1, startsAt: 1 });
bookingSchema.index({ userId: 1, startsAt: -1 });
bookingSchema.index({ teamId: 1, startsAt: -1 });

// Unpaid holds reap themselves. Only applies while status is `held`; confirmed
// bookings clear holdExpiresAt and are never touched by this.
bookingSchema.index(
  { holdExpiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { status: "held" },
    name: "expire_unpaid_holds",
  },
);

export type Booking = InferSchemaType<typeof bookingSchema>;
export type BookingDoc = HydratedDocument<Booking>;
export const BookingModel = model("Booking", bookingSchema);

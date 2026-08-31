import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * A maintenance window that removes a pitch from availability.
 *
 * The Supabase app stored these as rows in `bookings` with status "blocked" and
 * `team_id` set to the pitch id, because a team was required and there wasn't
 * one. That made every booking query carry a filter to exclude them, and made
 * the bookings table lie about what a booking is.
 */
const pitchBlockSchema = new Schema(
  {
    venueId: { type: Schema.Types.ObjectId, ref: "Venue", required: true },
    pitchId: { type: Schema.Types.ObjectId, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    reason: { type: String, default: null, maxlength: 200 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

pitchBlockSchema.index({ pitchId: 1, startsAt: 1, endsAt: 1 });
pitchBlockSchema.index({ venueId: 1, startsAt: 1 });

export type PitchBlock = InferSchemaType<typeof pitchBlockSchema>;
export type PitchBlockDoc = HydratedDocument<PitchBlock>;
export const PitchBlockModel = model("PitchBlock", pitchBlockSchema);

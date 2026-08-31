import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * Grants one user management rights over one venue.
 *
 * Deliberately not a role on the user document: authority here is per-venue,
 * and flattening it into `roles: ["venueManager"]` would hand every manager
 * authority over all 52 venues. This collection is the scope.
 */
const venueManagerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    venueId: { type: Schema.Types.ObjectId, ref: "Venue", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

venueManagerSchema.index({ userId: 1, venueId: 1 }, { unique: true });
venueManagerSchema.index({ venueId: 1 });

export type VenueManager = InferSchemaType<typeof venueManagerSchema>;
export type VenueManagerDoc = HydratedDocument<VenueManager>;
export const VenueManagerModel = model("VenueManager", venueManagerSchema);

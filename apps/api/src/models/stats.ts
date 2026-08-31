import { Schema, model, type InferSchemaType } from "mongoose";

/** Career totals per player, kept as a running aggregate. */
const playerStatsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    goals: { type: Number, default: 0, min: 0 },
    assists: { type: Number, default: 0, min: 0 },
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },
    cleanSheets: { type: Number, default: 0, min: 0 },
    totalMatches: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
playerStatsSchema.index({ userId: 1 }, { unique: true });

/** One player's line from one match. */
const matchStatsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    matchDate: { type: Date, required: true },
    goals: { type: Number, default: 0, min: 0 },
    assists: { type: Number, default: 0, min: 0 },
    cleanSheet: { type: Boolean, default: false },
  },
  { timestamps: true },
);
matchStatsSchema.index({ userId: 1, matchDate: -1 });
matchStatsSchema.index({ bookingId: 1 });

/** "Looking for a team" / "looking for players" listings. */
const playerListingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listingType: { type: String, required: true },
    position: { type: String, default: null },
    city: { type: String, default: null },
    availableDays: { type: [String], default: [] },
    message: { type: String, default: null, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
playerListingSchema.index({ isActive: 1, city: 1 });

export type PlayerStats = InferSchemaType<typeof playerStatsSchema>;
export type MatchStats = InferSchemaType<typeof matchStatsSchema>;
export type PlayerListing = InferSchemaType<typeof playerListingSchema>;

export const PlayerStatsModel = model("PlayerStats", playerStatsSchema);
export const MatchStatsModel = model("MatchStats", matchStatsSchema);
export const PlayerListingModel = model("PlayerListing", playerListingSchema);

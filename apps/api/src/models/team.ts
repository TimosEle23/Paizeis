import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * The roster is embedded — a squad is a handful of people, always read with the
 * team, and never queried on its own.
 *
 * Supabase had two overlapping tables: `team_roster` (12 rows, the actual
 * squad) and `team_members` (14 rows, carrying pending/accepted/declined). One
 * list with a status covers both without the ambiguity of asking which table
 * decides whether someone is on the team.
 */
const rosterEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    position: { type: String, default: null, maxlength: 50 },
    isCaptain: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["accepted", "pending", "declined"],
      default: "accepted",
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    captainId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roster: { type: [rosterEntrySchema], default: [] },
  },
  { timestamps: true },
);

/**
 * Supabase carried a `member_count` column that nothing kept in sync. Derived
 * here instead, so it cannot drift.
 */
teamSchema.virtual("memberCount").get(function () {
  return this.roster.filter((entry) => entry.status === "accepted").length;
});

teamSchema.set("toJSON", { virtuals: true });
teamSchema.set("toObject", { virtuals: true });

teamSchema.index({ captainId: 1 });
teamSchema.index({ "roster.userId": 1 });

export type Team = InferSchemaType<typeof teamSchema>;
export type TeamDoc = HydratedDocument<Team>;
export const TeamModel = model("Team", teamSchema);

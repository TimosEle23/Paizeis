import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * Tournaments are migrated but not exposed in the V1 app — the feature is built
 * on the web and hidden in the navbar, scheduled for a later monthly rollout.
 * The data comes across now so the rollout is a routing change, not a migration.
 */
const tournamentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    venueId: { type: Schema.Types.ObjectId, ref: "Venue", default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    maxTeams: { type: Number, default: null, min: 2 },
    prize: { type: String, default: null },
    status: { type: String, default: "upcoming" },
  },
  { timestamps: true },
);
tournamentSchema.index({ status: 1, startDate: 1 });

const tournamentTeamSchema = new Schema(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: "Tournament", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    points: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    goalsFor: { type: Number, default: 0 },
    goalsAgainst: { type: Number, default: 0 },
  },
  { timestamps: true },
);
tournamentTeamSchema.index({ tournamentId: 1, teamId: 1 }, { unique: true });

const tournamentMatchSchema = new Schema(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: "Tournament", required: true },
    round: { type: Number, required: true, min: 1 },
    team1Id: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    team2Id: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    team1Score: { type: Number, default: null },
    team2Score: { type: Number, default: null },
    matchDate: { type: Date, default: null },
    status: { type: String, default: "scheduled" },
  },
  { timestamps: true },
);
tournamentMatchSchema.index({ tournamentId: 1, round: 1 });

export type Tournament = InferSchemaType<typeof tournamentSchema>;
export const TournamentModel = model("Tournament", tournamentSchema);
export const TournamentTeamModel = model("TournamentTeam", tournamentTeamSchema);
export const TournamentMatchModel = model("TournamentMatch", tournamentMatchSchema);

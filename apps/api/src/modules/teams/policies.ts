import type { Types } from "mongoose";
import { ApiError } from "../../lib/errors.js";
import { TeamModel, type TeamDoc } from "../../models/index.js";
import type { Actor } from "../../types/express.js";
import { isAdmin } from "../auth/policies.js";

/**
 * Replaces the Supabase `teams` and `team_roster` policies:
 *   · "members can view their team"
 *   · "captains can update the team"
 *   · "captains manage the roster"
 */

export function isCaptain(actor: Actor, team: TeamDoc): boolean {
  return team.captainId.equals(actor.id) || isAdmin(actor);
}

export function isMember(actor: Actor, team: TeamDoc): boolean {
  if (isCaptain(actor, team)) return true;
  return team.roster.some(
    (entry) => entry.userId.equals(actor.id) && entry.status === "accepted",
  );
}

/** Loads a team the actor is on, or 404s. Never reveals a team they are not on. */
export async function loadTeamForMember(actor: Actor, teamId: Types.ObjectId): Promise<TeamDoc> {
  const team = await TeamModel.findById(teamId);
  if (!team || !isMember(actor, team)) throw ApiError.notFound("Team not found");
  return team;
}

/** Loads a team the actor captains. 403 here: they already know it exists. */
export async function loadTeamForCaptain(actor: Actor, teamId: Types.ObjectId): Promise<TeamDoc> {
  const team = await TeamModel.findById(teamId);
  if (!team) throw ApiError.notFound("Team not found");
  if (!isCaptain(actor, team)) throw ApiError.forbidden("Only the captain can do that");
  return team;
}

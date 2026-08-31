import { Types } from "mongoose";
import type { CreateTeamInput, RosterMemberDto, TeamDto } from "@paizeis/shared";
import { ApiError } from "../../lib/errors.js";
import { toObjectId } from "../../lib/tokens.js";
import { pushToUser } from "../../lib/push.js";
import { TeamMessageModel, TeamModel, UserModel, type TeamDoc } from "../../models/index.js";
import type { Actor } from "../../types/express.js";
import { isCaptain, loadTeamForCaptain, loadTeamForMember } from "./policies.js";

/**
 * Teams the actor belongs to.
 *
 * Replaces the Supabase `team_roster` policy "users can view rosters of teams
 * they are on" — expressed here as the query itself, so a team the caller is
 * not on can never be returned.
 */
export async function listMyTeams(actor: Actor): Promise<TeamDto[]> {
  const teams = await TeamModel.find({
    $or: [{ captainId: actor.id }, { "roster.userId": actor.id }],
  })
    .sort({ createdAt: -1 })
    .lean();

  // One lookup for every member across all the teams, rather than per team.
  const memberIds = teams.flatMap((team) => team.roster.map((entry) => entry.userId));
  const members = await UserModel.find({ _id: { $in: memberIds } })
    .select("fullName email avatarUrl")
    .lean();
  const byId = new Map(members.map((member) => [String(member._id), member]));

  return teams.map((team) => ({
    id: String(team._id),
    name: team.name,
    captainId: String(team.captainId),
    memberCount: team.roster.filter((entry) => entry.status === "accepted").length,
    roster: team.roster.map((entry) => {
      const member = byId.get(String(entry.userId));
      return {
        userId: String(entry.userId),
        fullName: member?.fullName ?? "Unknown player",
        email: member?.email ?? "",
        avatarUrl: member?.avatarUrl ?? null,
        position: entry.position ?? null,
        isCaptain: entry.isCaptain === true,
        joinedAt: (entry.joinedAt ?? new Date()).toISOString(),
      };
    }),
    createdAt: (team.createdAt as Date).toISOString(),
  }));
}

/**
 * Creates a team with the caller as captain and first accepted member.
 *
 * The booking flow needs this: a booking must name a team, and a new player has
 * none. The web app solves it with a dialog on the booking page; the app does
 * the same inline rather than sending someone off to another screen mid-booking.
 */
export async function createTeam(actor: Actor, input: CreateTeamInput): Promise<TeamDto> {
  const team = await TeamModel.create({
    name: input.name,
    captainId: actor.id,
    roster: [{ userId: actor.id, isCaptain: true, status: "accepted", joinedAt: new Date() }],
  });

  const user = await UserModel.findById(actor.id).select("fullName email avatarUrl").lean();

  return {
    id: team.id,
    name: team.name,
    captainId: actor.id.toHexString(),
    memberCount: 1,
    roster: [
      {
        userId: actor.id.toHexString(),
        fullName: user?.fullName ?? "",
        email: user?.email ?? "",
        avatarUrl: user?.avatarUrl ?? null,
        position: null,
        isCaptain: true,
        joinedAt: new Date().toISOString(),
      },
    ],
    createdAt: (team.get("createdAt") as Date).toISOString(),
  };
}


/** Expands a team document into the wire shape, resolving every member's name. */
async function toTeamDto(team: TeamDoc): Promise<TeamDto> {
  const members = await UserModel.find({ _id: { $in: team.roster.map((e) => e.userId) } })
    .select("fullName email avatarUrl")
    .lean();
  const byId = new Map(members.map((m) => [String(m._id), m]));

  return {
    id: team.id,
    name: team.name,
    captainId: String(team.captainId),
    memberCount: team.roster.filter((e) => e.status === "accepted").length,
    roster: team.roster.map((entry): RosterMemberDto => {
      const member = byId.get(String(entry.userId));
      return {
        userId: String(entry.userId),
        fullName: member?.fullName ?? "Unknown player",
        email: member?.email ?? "",
        avatarUrl: member?.avatarUrl ?? null,
        position: entry.position ?? null,
        isCaptain: entry.isCaptain === true,
        joinedAt: (entry.joinedAt ?? new Date()).toISOString(),
      };
    }),
    createdAt: (team.get("createdAt") as Date).toISOString(),
  };
}

/** One team, readable only by the people on it. */
export async function getTeam(actor: Actor, id: string): Promise<TeamDto> {
  return toTeamDto(await loadTeamForMember(actor, toObjectId(id)));
}

export async function renameTeam(actor: Actor, id: string, name: string): Promise<TeamDto> {
  const team = await loadTeamForCaptain(actor, toObjectId(id));
  team.name = name;
  await team.save();
  return toTeamDto(team);
}

/**
 * Adds a player by email. They must already have an account — inviting someone
 * who does not is the job of the match-invitation flow, which can email them.
 */
export async function addMember(actor: Actor, id: string, email: string): Promise<TeamDto> {
  const team = await loadTeamForCaptain(actor, toObjectId(id));
  const user = await UserModel.findOne({ email: email.toLowerCase().trim() }).select("_id fullName").lean();

  if (!user) throw ApiError.notFound("Nobody with that email has an account yet");
  if (team.roster.some((entry) => entry.userId.equals(user._id))) {
    throw ApiError.conflict("They are already on this team");
  }

  team.roster.push({
    userId: new Types.ObjectId(user._id),
    status: "accepted",
    isCaptain: false,
    position: null,
    joinedAt: new Date(),
  } as never);
  await team.save();

  await pushToUser(new Types.ObjectId(user._id), {
    title: `You've joined ${team.name}`,
    body: "You can now be picked for their matches.",
    data: { type: "team-joined", teamId: team.id },
  });

  return toTeamDto(team);
}

/** Removes a player. The captain cannot remove themselves — they leave instead. */
export async function removeMember(actor: Actor, id: string, userId: string): Promise<TeamDto> {
  const team = await loadTeamForCaptain(actor, toObjectId(id));
  const target = toObjectId(userId);

  if (team.captainId.equals(target)) {
    throw ApiError.conflict("The captain cannot be removed. Hand over the captaincy first");
  }

  team.roster = team.roster.filter((entry) => !entry.userId.equals(target)) as never;
  await team.save();
  return toTeamDto(team);
}

/**
 * Leaving. A captain who leaves hands the armband to the longest-serving
 * remaining member, so a team is never left without one; the last person out
 * deletes the team.
 */
export async function leaveTeam(actor: Actor, id: string): Promise<{ left: true; teamDeleted: boolean }> {
  const team = await loadTeamForMember(actor, toObjectId(id));

  team.roster = team.roster.filter((entry) => !entry.userId.equals(actor.id)) as never;

  if (team.roster.length === 0) {
    await team.deleteOne();
    await TeamMessageModel.deleteMany({ teamId: team._id });
    return { left: true, teamDeleted: true };
  }

  if (team.captainId.equals(actor.id)) {
    const successor = [...team.roster].sort(
      (a, b) => (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0),
    )[0]!;
    team.captainId = successor.userId;
    successor.isCaptain = true;

    await pushToUser(successor.userId, {
      title: `You're now captain of ${team.name}`,
      body: "You can manage the squad and book pitches for them.",
      data: { type: "team-captaincy", teamId: team.id },
    });
  }

  await team.save();
  return { left: true, teamDeleted: false };
}

export interface TeamMessageDto {
  id: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
  /** True when the message is the caller's own, so the UI can align it. */
  mine: boolean;
}

/** The team's chat, oldest first so it reads top to bottom. */
export async function listMessages(actor: Actor, id: string, limit = 100): Promise<TeamMessageDto[]> {
  const team = await loadTeamForMember(actor, toObjectId(id));

  const messages = await TeamMessageModel.find({ teamId: team._id })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 200))
    .lean();

  const authors = await UserModel.find({ _id: { $in: messages.map((m) => m.userId) } })
    .select("fullName")
    .lean();
  const nameById = new Map(authors.map((a) => [String(a._id), a.fullName]));

  return messages.reverse().map((message) => ({
    id: String(message._id),
    userId: String(message.userId),
    authorName: nameById.get(String(message.userId)) ?? "Unknown player",
    body: message.body,
    createdAt: (message.createdAt as Date).toISOString(),
    mine: message.userId.equals(actor.id),
  }));
}

/** Posts a message and notifies the rest of the squad. */
export async function postMessage(actor: Actor, id: string, body: string): Promise<TeamMessageDto> {
  const team = await loadTeamForMember(actor, toObjectId(id));
  const author = await UserModel.findById(actor.id).select("fullName").lean();

  const message = await TeamMessageModel.create({ teamId: team._id, userId: actor.id, body });

  // Everyone on the team except the person who just typed it.
  const others = team.roster
    .filter((entry) => entry.status === "accepted" && !entry.userId.equals(actor.id))
    .map((entry) => entry.userId);

  await Promise.all(
    others.map((userId) =>
      pushToUser(userId, {
        title: `${author?.fullName ?? "Someone"} · ${team.name}`,
        body: body.length > 120 ? `${body.slice(0, 117)}…` : body,
        data: { type: "team-message", teamId: team.id },
      }),
    ),
  );

  return {
    id: message.id,
    userId: actor.id.toHexString(),
    authorName: author?.fullName ?? "",
    body: message.body,
    createdAt: (message.get("createdAt") as Date).toISOString(),
    mine: true,
  };
}

export { isCaptain };

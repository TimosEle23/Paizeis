import type { Types } from "mongoose";
import type { Actor } from "../../types/express.js";
import { ApiError } from "../../lib/errors.js";
import { TeamModel } from "../../models/index.js";
import { isAdmin, managesVenue } from "../auth/policies.js";

/**
 * Replaces the Supabase `bookings` policies:
 *   · "Users can view own bookings"
 *   · "Venue managers can view bookings for their venues"
 *   · "Users can create own bookings"
 *   · "Users can update own bookings" / "Venue managers can update"
 */

export interface BookingLike {
  userId: Types.ObjectId;
  teamId: Types.ObjectId;
  venueId: Types.ObjectId;
}

/** The person who booked, anyone on that team, the venue's manager, or an admin. */
export async function canViewBooking(actor: Actor, booking: BookingLike): Promise<boolean> {
  if (actor.id.equals(booking.userId)) return true;
  if (isAdmin(actor)) return true;
  if (await managesVenue(actor, booking.venueId)) return true;
  // Teammates can see the match they are down to play in.
  return Boolean(await TeamModel.exists({ _id: booking.teamId, "roster.userId": actor.id }));
}

/** Cancelling is narrower than viewing: the booker, the venue's manager, or an admin. */
export async function canModifyBooking(actor: Actor, booking: BookingLike): Promise<boolean> {
  if (actor.id.equals(booking.userId)) return true;
  if (isAdmin(actor)) return true;
  return managesVenue(actor, booking.venueId);
}

export async function assertCanViewBooking(actor: Actor, booking: BookingLike): Promise<void> {
  // 404, not 403: a stranger must not learn that a booking id exists.
  if (!(await canViewBooking(actor, booking))) throw ApiError.notFound("Booking not found");
}

export async function assertCanModifyBooking(actor: Actor, booking: BookingLike): Promise<void> {
  if (!(await canModifyBooking(actor, booking))) throw ApiError.notFound("Booking not found");
}

/** You may only book on behalf of a team you are actually on. */
export async function assertOnTeam(actor: Actor, teamId: Types.ObjectId): Promise<void> {
  const onTeam = await TeamModel.exists({
    _id: teamId,
    $or: [{ captainId: actor.id }, { roster: { $elemMatch: { userId: actor.id, status: "accepted" } } }],
  });
  if (!onTeam) throw ApiError.forbidden("You are not on that team");
}

import type { Types } from "mongoose";
import type { Actor } from "../../types/express.js";
import { ApiError } from "../../lib/errors.js";
import { VenueManagerModel } from "../../models/index.js";

/**
 * Shared predicates. Each corresponds to a Supabase RLS policy — see
 * docs/authorization.md for the mapping and the test that proves each one.
 */

export const isAdmin = (actor: Actor): boolean => actor.roles.includes("admin");

export const isSelf = (actor: Actor, userId: Types.ObjectId): boolean => actor.id.equals(userId);

/** True when the actor manages this specific venue, or is an admin. */
export async function managesVenue(actor: Actor, venueId: Types.ObjectId): Promise<boolean> {
  if (isAdmin(actor)) return true;
  return Boolean(await VenueManagerModel.exists({ userId: actor.id, venueId }));
}

/**
 * Throws 404 rather than 403 for resources the actor should not learn exist.
 * A 403 on "venue 5's bookings" confirms venue 5 has bookings; a 404 does not.
 */
export async function assertManagesVenue(actor: Actor, venueId: Types.ObjectId): Promise<void> {
  if (!(await managesVenue(actor, venueId))) throw ApiError.notFound();
}

export function assertSelfOrAdmin(actor: Actor, userId: Types.ObjectId): void {
  if (!isSelf(actor, userId) && !isAdmin(actor)) throw ApiError.notFound();
}

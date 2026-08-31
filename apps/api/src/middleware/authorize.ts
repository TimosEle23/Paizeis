import type { RequestHandler } from "express";
import type { Role } from "@paizeis/shared";
import { ApiError } from "../lib/errors.js";
import { VenueManagerModel } from "../models/index.js";
import { requireActor } from "./authenticate.js";

/**
 * Global role gate. Covers only the coarse cases — admin-only surfaces. Most
 * authorization here is per-resource ownership and lives in module policies.
 */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    const actor = requireActor(req);
    if (!roles.some((role) => actor.roles.includes(role))) {
      return next(ApiError.forbidden());
    }
    next();
  };

/**
 * Admits venue managers, and admins as a superset.
 *
 * Being a manager is not a global role: it is a row linking one user to one
 * venue. This only establishes that the caller manages *something* — which
 * venue is checked per request by `assertManagesVenue`, or the manager of one
 * pitch could edit all 52 venues.
 */
export const requireVenueManager: RequestHandler = async (req, _res, next) => {
  try {
    const actor = requireActor(req);
    if (actor.roles.includes("admin")) return next();

    const manages = await VenueManagerModel.exists({ userId: actor.id });
    if (!manages) return next(ApiError.forbidden());
    next();
  } catch (err) {
    next(err);
  }
};

import type { Request, RequestHandler } from "express";
import { ApiError } from "../lib/errors.js";
import type { Actor } from "../types/express.js";
import { toObjectId, verifyAccessToken } from "../lib/tokens.js";

/**
 * Resolves the caller from the Authorization header and attaches `req.actor`.
 *
 * It answers "who is this", never "may they". Permission is decided per
 * resource in each module's policies, because most of what the old RLS policies
 * expressed was ownership, not role.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(ApiError.unauthenticated());
  }

  const payload = verifyAccessToken(header.slice("Bearer ".length).trim());
  req.actor = {
    id: toObjectId(payload.sub),
    email: payload.email,
    roles: payload.roles ?? ["user"],
  };
  next();
};

/**
 * Attaches the actor when a token is present, but allows anonymous callers.
 * For endpoints whose *response* differs when signed in — the venues list
 * showing your own bookings, for instance — rather than ones that require it.
 */
export const authenticateOptional: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length).trim());
    req.actor = { id: toObjectId(payload.sub), email: payload.email, roles: payload.roles ?? ["user"] };
  } catch {
    // An invalid token on an optional route is treated as anonymous, not an error.
  }
  next();
};

/**
 * Reads the actor, asserting it is present. Use inside handlers mounted behind
 * `authenticate`, where its absence is a wiring mistake rather than a 401.
 */
export function requireActor(req: Request): Actor {
  if (!req.actor) throw ApiError.unauthenticated();
  return req.actor;
}

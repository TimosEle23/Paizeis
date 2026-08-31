import rateLimit from "express-rate-limit";
import { ApiError } from "../lib/errors.js";
import { isTest } from "../config/env.js";

/**
 * Server-side rate limiting.
 *
 * The web app enforced this in localStorage, which anyone can clear — the
 * comment in that file called it "a first line of defence", and it was the
 * only line. Enforced here it cannot be bypassed by the client.
 */
const handler = () => {
  throw ApiError.rateLimited();
};

/** Sign-in and registration: strict, keyed by IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 10_000 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

/** Password reset and invitations — abusable to spam someone else's inbox. */
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isTest ? 10_000 : 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

/** Everything else: generous, to catch runaway clients rather than users. */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isTest ? 100_000 : 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

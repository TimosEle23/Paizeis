import { Router } from "express";
import {
  appleSignInSchema, googleSignInSchema, refreshSchema, signInSchema, signUpSchema,
} from "@paizeis/shared";
import { validateBody } from "../../middleware/validate.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { ApiError } from "../../lib/errors.js";
import * as auth from "./service.js";

export const authRouter: Router = Router();

/** Everything the client's browser or device tells us about this session. */
const context = (req: { headers: Record<string, unknown>; ip?: string }) => ({
  userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
  ip: req.ip ?? null,
});

// All public — these are how a caller becomes authenticated.
authRouter.post("/register", authLimiter, validateBody(signUpSchema), async (req, res) => {
  res.status(201).json(await auth.register(req.body, context(req)));
});

authRouter.post("/login", authLimiter, validateBody(signInSchema), async (req, res) => {
  res.json(await auth.signIn(req.body, context(req)));
});

authRouter.post("/refresh", validateBody(refreshSchema), async (req, res) => {
  res.json(await auth.refresh(req.body.refreshToken, context(req)));
});

authRouter.post("/logout", validateBody(refreshSchema), async (req, res) => {
  await auth.signOut(req.body.refreshToken);
  res.status(204).send();
});

authRouter.post("/google", authLimiter, validateBody(googleSignInSchema), async (req, res) => {
  res.json(await auth.signInWithGoogle(req.body, context(req)));
});

authRouter.post("/apple", authLimiter, validateBody(appleSignInSchema), async (req, res) => {
  res.json(await auth.signInWithApple(req.body, context(req)));
});

// Placeholder so the route exists in the contract; wired to Resend in Phase 3.
authRouter.post("/password/forgot", authLimiter, (_req, _res) => {
  throw ApiError.internal("Password reset is not configured yet");
});

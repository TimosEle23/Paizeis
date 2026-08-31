import { Router } from "express";
import mongoose from "mongoose";
import { authRouter } from "./modules/auth/routes.js";
import { meRouter } from "./modules/me/routes.js";
import { venuesRouter } from "./modules/venues/routes.js";
import { bookingsRouter } from "./modules/bookings/routes.js";
import { webhooksRouter } from "./modules/payments/routes.js";
import { teamsRouter } from "./modules/teams/routes.js";
import { invitationsRouter } from "./modules/invitations/routes.js";
import { generalLimiter } from "./middleware/rateLimit.js";

/**
 * API surface, versioned. Every module mounted here declares its own access
 * level per route (public / auth / venueManager / admin) — see
 * docs/authorization.md for the rule behind each one.
 */
export const apiRouter: Router = Router();

/** Mongoose also reports 99 ("uninitialized"), so this is a map, not a tuple. */
const MONGO_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
  99: "uninitialized",
};

apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "paizeis-api",
    version: "0.1.0",
    mongo: MONGO_STATES[mongoose.connection.readyState] ?? "unknown",
    uptimeSeconds: Math.round(process.uptime()),
  });
});

apiRouter.use(generalLimiter);

// Public: how a caller becomes authenticated.
apiRouter.use("/auth", authRouter);
// Authenticated, and scoped to the caller themselves.
apiRouter.use("/me", meRouter);

// Public: browsing venues and checking availability needs no account.
apiRouter.use("/venues", venuesRouter);
// Authenticated, authorised per booking.
apiRouter.use("/bookings", bookingsRouter);
// Public route, authenticated by Stripe signature.
apiRouter.use("/webhooks", webhooksRouter);

apiRouter.use("/teams", teamsRouter);
apiRouter.use("/invitations", invitationsRouter);

// Still to come
// apiRouter.use("/invitations", invitationsRouter);
// apiRouter.use("/venue-admin", venueAdminRouter);
// apiRouter.use("/admin", adminRouter);

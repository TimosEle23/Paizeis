import { Router } from "express";
import { z } from "zod";
import { emailField } from "@paizeis/shared";
import { authenticate, requireActor } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import { pathParam } from "../../middleware/validate.js";
import { emailLimiter } from "../../middleware/rateLimit.js";
import { inviteToBooking, listMyInvitations, respondToInvitation } from "./service.js";

export const invitationsRouter: Router = Router();

invitationsRouter.use(authenticate);

/** Invitations addressed to me. */
invitationsRouter.get("/", async (req, res) => {
  res.json(await listMyInvitations(requireActor(req)));
});

invitationsRouter.post("/:id/accept", async (req, res) => {
  res.json(await respondToInvitation(requireActor(req), pathParam(req, "id"), true));
});

invitationsRouter.post("/:id/decline", async (req, res) => {
  res.json(await respondToInvitation(requireActor(req), pathParam(req, "id"), false));
});

/** Mounted under /bookings/:id/invitations — rate limited, since it emails people. */
export const bookingInvitesRouter: Router = Router({ mergeParams: true });

bookingInvitesRouter.post(
  "/",
  emailLimiter,
  validateBody(z.object({ email: emailField })),
  async (req, res) => {
    res.status(201).json(await inviteToBooking(requireActor(req), pathParam(req, "id"), req.body.email));
  },
);

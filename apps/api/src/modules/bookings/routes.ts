import { Router } from "express";
import { cancelBookingSchema, createBookingSchema } from "@paizeis/shared";
import { authenticate, requireActor } from "../../middleware/authenticate.js";
import { validateBody, pathParam } from "../../middleware/validate.js";
import { createCheckoutSession } from "../payments/service.js";
import { bookingInvitesRouter } from "../invitations/routes.js";
import * as bookings from "./service.js";

export const bookingsRouter: Router = Router();

bookingsRouter.use(authenticate);

bookingsRouter.post("/", validateBody(createBookingSchema), async (req, res) => {
  res.status(201).json(await bookings.createBooking(requireActor(req), req.body));
});

bookingsRouter.get("/:id", async (req, res) => {
  res.json(await bookings.getBooking(requireActor(req), pathParam(req, "id")));
});

bookingsRouter.post("/:id/cancel", validateBody(cancelBookingSchema), async (req, res) => {
  res.json(await bookings.cancelBooking(requireActor(req), pathParam(req, "id"), req.body.reason));
});

/** Invite a player to this specific match. */
bookingsRouter.use("/:id/invitations", bookingInvitesRouter);

bookingsRouter.post("/:id/checkout", async (req, res) => {
  res.json(await createCheckoutSession(requireActor(req), pathParam(req, "id")));
});

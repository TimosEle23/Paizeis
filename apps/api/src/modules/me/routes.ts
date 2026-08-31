import { Router } from "express";
import { deleteAccountSchema, registerDeviceSchema, updateProfileSchema } from "@paizeis/shared";
import { authenticate, requireActor } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import { ApiError } from "../../lib/errors.js";
import { DeviceModel, PlayerStatsModel, SessionModel, UserModel } from "../../models/index.js";
import { listMyBookings } from "../bookings/service.js";
import { signOutEverywhere, toUserDto } from "../auth/service.js";

export const meRouter: Router = Router();

// Everything below requires a signed-in caller, and acts only on that caller.
meRouter.use(authenticate);

meRouter.get("/", async (req, res) => {
  const actor = requireActor(req);
  const user = await UserModel.findById(actor.id);
  if (!user) throw ApiError.unauthenticated();
  res.json(toUserDto(user));
});

meRouter.patch("/", validateBody(updateProfileSchema), async (req, res) => {
  const actor = requireActor(req);
  const user = await UserModel.findById(actor.id);
  if (!user) throw ApiError.unauthenticated();

  const { fullName, phone, location, email } = req.body;
  if (fullName !== undefined) user.fullName = fullName;
  if (phone !== undefined) user.phone = phone || null;
  if (location !== undefined) user.location = location || null;

  // A changed email is no longer a verified one; re-verification is handled by
  // the email flow rather than trusting whatever address was just typed in.
  if (email !== undefined && email !== user.email) {
    if (await UserModel.exists({ email, _id: { $ne: user._id } })) {
      throw ApiError.conflict("That email is already in use");
    }
    user.email = email;
    user.emailVerifiedAt = null;
  }

  await user.save();
  res.json(toUserDto(user));
});

/** The caller's bookings — the site's Profile "Booking History" panel. */
meRouter.get("/bookings", async (req, res) => {
  res.json(await listMyBookings(requireActor(req)));
});

/** Career totals — the site's "Career Stats" tiles. */
meRouter.get("/stats", async (req, res) => {
  const actor = requireActor(req);
  const stats = await PlayerStatsModel.findOne({ userId: actor.id }).lean();

  // A player with no recorded matches gets zeroes, not a 404: the panel always
  // renders, and "no stats yet" is a legitimate state.
  res.json({
    userId: actor.id.toHexString(),
    goals: stats?.goals ?? 0,
    assists: stats?.assists ?? 0,
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
    cleanSheets: stats?.cleanSheets ?? 0,
    totalMatches: stats?.totalMatches ?? 0,
  });
});

meRouter.post("/devices", validateBody(registerDeviceSchema), async (req, res) => {
  const actor = requireActor(req);
  await DeviceModel.findOneAndUpdate(
    { expoPushToken: req.body.expoPushToken },
    { userId: actor.id, platform: req.body.platform, lastSeenAt: new Date() },
    { upsert: true },
  );
  res.status(204).send();
});

/**
 * In-app account deletion. Required by App Store guideline 5.1.1(v): an app
 * that creates accounts must let people delete them without emailing support.
 */
meRouter.delete("/", validateBody(deleteAccountSchema), async (req, res) => {
  const actor = requireActor(req);

  await signOutEverywhere(actor.id);
  await SessionModel.deleteMany({ userId: actor.id });
  await DeviceModel.deleteMany({ userId: actor.id });
  await UserModel.deleteOne({ _id: actor.id });

  // Bookings are deliberately left: a venue's record of who booked and paid is
  // not solely the user's to erase. Anonymising them is a Phase 3 task, once
  // the booking service exists to do it properly.
  res.status(204).send();
});

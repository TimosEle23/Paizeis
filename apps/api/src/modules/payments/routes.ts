import { Router } from "express";
import Stripe from "stripe";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { handleStripeEvent } from "./service.js";

export const webhooksRouter: Router = Router();

/**
 * Stripe webhook. Public by necessity, authenticated by signature.
 *
 * Stripe signs the raw bytes, so this verifies against `req.rawBody`, captured
 * by the JSON parser's `verify` hook. Verifying a re-serialised body fails on
 * any difference in key order or whitespace.
 */
webhooksRouter.post("/stripe", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    throw ApiError.internal("Payments are not configured");
  }
  if (typeof signature !== "string" || !rawBody) {
    throw ApiError.badRequest("Missing Stripe signature");
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, "rejected a stripe webhook with an invalid signature");
    throw ApiError.forbidden("Invalid signature");
  }

  await handleStripeEvent(event);

  // Always 200 once the signature is verified: a non-2xx makes Stripe retry,
  // and a bad booking id is not something a retry will fix.
  res.json({ received: true });
});

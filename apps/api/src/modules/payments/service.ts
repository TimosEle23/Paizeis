import Stripe from "stripe";
import type { CheckoutSessionDto } from "@paizeis/shared";
import { CURRENCY } from "@paizeis/shared";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/errors.js";
import { toObjectId } from "../../lib/tokens.js";
import { logger } from "../../lib/logger.js";
import { BookingModel } from "../../models/index.js";
import type { Actor } from "../../types/express.js";
import { assertCanModifyBooking } from "../bookings/policies.js";

let stripe: Stripe | null = null;

function client(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw ApiError.internal("Payments are not configured");
  stripe ??= new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion });
  return stripe;
}

/**
 * Creates a Stripe Checkout session for a booking's deposit.
 *
 * The amount is read from the booking, which computed it from the venue's own
 * price. The web app instead redirected to a hardcoded *test* payment link with
 * no amount attached, so what someone paid bore no relation to what they booked.
 *
 * Pitch hire is a real-world service, so App Store guideline 3.1.3(e) permits
 * paying outside the app — no in-app purchase, no 30% cut, and one payment path
 * shared by the website and both apps.
 */
export async function createCheckoutSession(actor: Actor, bookingId: string): Promise<CheckoutSessionDto> {
  const booking = await BookingModel.findById(toObjectId(bookingId));
  if (!booking) throw ApiError.notFound("Booking not found");

  await assertCanModifyBooking(actor, booking);

  if (booking.status === "confirmed") throw ApiError.conflict("That booking is already paid");
  if (booking.status !== "held") throw ApiError.conflict("That booking can no longer be paid for");
  if (booking.holdExpiresAt && booking.holdExpiresAt.getTime() < Date.now()) {
    throw ApiError.conflict("The hold on that slot has expired");
  }

  const session = await client().checkout.sessions.create({
    mode: "payment",
    client_reference_id: booking.id,
    // The webhook trusts this, not anything the client sends back.
    metadata: { bookingId: booking.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY.toLowerCase(),
          unit_amount: Math.round(booking.depositAmount * 100),
          product_data: {
            name: `Deposit — ${booking.venueName}, ${booking.pitchName}`,
            description: `${booking.durationHours}h from ${booking.startsAt.toISOString()}`,
          },
        },
      },
    ],
    success_url: `${env.PUBLIC_WEB_URL}/booking-success?booking=${booking.id}`,
    cancel_url: `${env.PUBLIC_WEB_URL}/booking/${booking.venueId}`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });

  booking.stripeSessionId = session.id;
  await booking.save();

  if (!session.url) throw ApiError.internal("Stripe did not return a checkout URL");

  return {
    bookingId: booking.id,
    checkoutUrl: session.url,
    expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString(),
  };
}

/**
 * Handles a verified Stripe event. Signature checking happens in the route,
 * against the raw request body — a parsed body cannot be verified.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const object = event.data.object as { metadata?: Record<string, string>; client_reference_id?: string | null };
  const bookingId = object.metadata?.bookingId ?? object.client_reference_id ?? null;

  if (!bookingId) {
    logger.warn({ type: event.type }, "stripe event carried no booking id");
    return;
  }

  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    // Clearing holdExpiresAt is what takes the booking out of the TTL index's
    // reach — without it a paid booking would be deleted when the hold lapsed.
    const result = await BookingModel.updateOne(
      { _id: bookingId, status: { $in: ["held", "confirmed"] } },
      { $set: { status: "confirmed", holdExpiresAt: null } },
    );
    logger.info({ bookingId, matched: result.matchedCount }, "booking confirmed by stripe");
    return;
  }

  if (event.type === "payment_intent.payment_failed" || event.type === "checkout.session.expired") {
    await BookingModel.updateOne(
      { _id: bookingId, status: "held" },
      { $set: { status: "payment_failed", holdExpiresAt: null } },
    );
    logger.info({ bookingId }, "booking payment failed; slot released");
  }
}

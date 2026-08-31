import type { Types } from "mongoose";
import { DeviceModel } from "../models/index.js";
import { logger } from "./logger.js";

/**
 * Expo push notifications.
 *
 * Expo's push service is free and needs no key — it takes the ExpoPushToken the
 * app registered and routes to APNs or FCM itself. That is why this is a plain
 * fetch rather than an SDK with credentials.
 */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  title: string;
  body: string;
  /** Delivered to the app so a tap can open the right screen. */
  data?: Record<string, unknown>;
}

/** Sends to every device a user has registered. Silently does nothing if none. */
export async function pushToUser(userId: Types.ObjectId, message: PushMessage): Promise<void> {
  const devices = await DeviceModel.find({ userId }).select("expoPushToken").lean();
  if (devices.length === 0) return;

  const messages = devices.map((device) => ({
    to: device.expoPushToken,
    sound: "default",
    title: message.title,
    body: message.body,
    data: message.data ?? {},
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });

    const result = (await response.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };

    // A token goes stale when the app is uninstalled. Expo tells us; drop it
    // rather than pushing to it forever.
    for (const [index, outcome] of (result.data ?? []).entries()) {
      if (outcome.status === "error" && outcome.details?.error === "DeviceNotRegistered") {
        await DeviceModel.deleteOne({ expoPushToken: devices[index]?.expoPushToken });
      }
    }
  } catch (err) {
    // A push that fails must never fail the request that triggered it — the
    // invitation is still valid whether or not the phone buzzed.
    logger.warn({ err, userId }, "push notification failed");
  }
}

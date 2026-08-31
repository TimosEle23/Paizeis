import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { me } from "./api/endpoints";

/**
 * Push notifications, used for match invitations and their replies.
 *
 * Expo Push is free and needs no key of ours — Expo holds the APNs and FCM
 * credentials and routes on our behalf. The device registers its ExpoPushToken
 * with the API, and the server pushes to it when someone is invited.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Asks for permission and registers this device with the API.
 *
 * Called after sign-in rather than on first launch: a permission prompt before
 * someone knows what the app is for is the fastest route to a permanent no.
 * Returns null on a simulator, which cannot receive push at all.
 */
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Match invitations",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;

  /**
   * Without an EAS project id, Expo cannot mint a push token and throws. That
   * is the normal state until the project is linked to an Expo account, so it
   * is reported and swallowed rather than allowed to crash the app.
   *
   * Invitations still work in the meantime — they appear in the Bookings tab.
   * What is missing is only the OS-level notification.
   */
  if (!projectId) {
    console.info(
      "[push] no EAS projectId — device not registered. " +
        "Run `npx eas init` in apps/mobile to enable push notifications.",
    );
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await me.registerDevice(token.data, Platform.OS === "ios" ? "ios" : "android");
    return token.data;
  } catch (error) {
    // Never let a push failure break sign-in.
    console.info("[push] registration failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

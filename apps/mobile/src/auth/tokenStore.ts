import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Where session tokens live.
 *
 * On a device that is the iOS Keychain / Android Keystore via expo-secure-store,
 * which is the whole point — AsyncStorage would leave refresh tokens in plain
 * files readable by anything else on a rooted device.
 *
 * expo-secure-store has no web implementation and throws there, so the browser
 * falls back to localStorage. That is a weaker store, and acceptable only
 * because the web target exists for development previews; the shipped apps are
 * native and never take this path.
 */
const isWeb = Platform.OS === "web";

export async function getToken(key: string): Promise<string | null> {
  try {
    if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setToken(key: string, value: string): Promise<void> {
  try {
    if (isWeb) globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // A failed write means the session will not survive a restart. Not worth
    // blocking sign-in over — the tokens still work for this session.
  }
}

export async function deleteToken(key: string): Promise<void> {
  try {
    if (isWeb) globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore: the in-memory refs are cleared regardless, so the user is signed
    // out of this session either way.
  }
}

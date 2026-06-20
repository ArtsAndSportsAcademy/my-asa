import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Foreground notification behavior: show the banner even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

function devicePlatform(): "IOS" | "ANDROID" | null {
  if (Platform.OS === "ios") return "IOS";
  if (Platform.OS === "android") return "ANDROID";
  return null;
}

function resolveProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

/**
 * Requests notification permission, obtains the Expo push token and registers
 * it with the backend. Safe to call repeatedly (backend upserts by token).
 *
 * Returns the push token on success, or null if running on a non-device,
 * permission was denied, or any step failed. Never throws.
 *
 * NOTE: A real Expo push token can only be obtained on a physical device /
 * Expo Go build — the web workspace preview cannot deliver system-tray push.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      // Simulators / web preview cannot receive push.
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Notificações MyASA",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#5B21B6",
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return null;
    }

    const projectId = resolveProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token) return null;

    await sendTokenToBackend(token);
    return token;
  } catch {
    // Push is best-effort — never block the app on registration failure.
    return null;
  }
}

async function sendTokenToBackend(token: string): Promise<void> {
  const [authToken, baseUrl] = await Promise.all([
    AsyncStorage.getItem("myasa_access_token"),
    Promise.resolve(getBaseUrl()),
  ]);
  if (!authToken) return;

  await fetch(`${baseUrl}/api/notifications/device-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, platform: devicePlatform() }),
  });
}

/** Removes the device token from the backend (call on logout). */
export async function unregisterPushNotificationsAsync(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const projectId = resolveProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token) return;

    const [authToken, baseUrl] = await Promise.all([
      AsyncStorage.getItem("myasa_access_token"),
      Promise.resolve(getBaseUrl()),
    ]);
    if (!authToken) return;

    await fetch(`${baseUrl}/api/notifications/device-token`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    // best-effort
  }
}

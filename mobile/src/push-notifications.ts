import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushDestination = {
  activityId: string;
  notificationId: string | null;
};

export type PushPermissionState =
  | "granted"
  | "not-determined"
  | "denied"
  | "unsupported";

function hasIosPermission(status: Notifications.NotificationPermissionsStatus) {
  const authorization = status.ios?.status;
  return (
    authorization === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    authorization === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    authorization === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

function readProjectId() {
  const configured = Constants.expoConfig?.extra?.eas?.projectId;
  const built = Constants.easConfig?.projectId;
  return typeof configured === "string"
    ? configured
    : typeof built === "string"
      ? built
      : null;
}

export function hasPushProjectConfiguration() {
  return Boolean(readProjectId());
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (!Device.isDevice) return "unsupported";
  const status = await Notifications.getPermissionsAsync();
  if (status.granted || hasIosPermission(status)) return "granted";

  if (
    Platform.OS === "ios" &&
    status.ios?.status === Notifications.IosAuthorizationStatus.NOT_DETERMINED
  ) {
    return "not-determined";
  }
  return status.status === "undetermined" ? "not-determined" : "denied";
}

export async function acquireExpoPushToken(requestPermission: boolean) {
  if (!Device.isDevice) return null;
  const projectId = readProjectId();
  if (!projectId) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("activity-updates", {
      name: "모임 소식",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: "#4771F5",
    });
  }

  let state = await getPushPermissionState();
  if (state === "not-determined" && requestPermission) {
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    state =
      requested.granted || hasIosPermission(requested) ? "granted" : "denied";
  }
  if (state !== "granted") return null;

  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error) {
    console.warn("Could not acquire an Expo push token", error);
    return null;
  }
}

export function getPushDestination(
  response: Notifications.NotificationResponse | null,
): PushDestination | null {
  const data = response?.notification.request.content.data;
  const activityId = typeof data?.activityId === "string" ? data.activityId : "";
  if (!activityId) return null;
  return {
    activityId,
    notificationId:
      typeof data?.notificationId === "string" ? data.notificationId : null,
  };
}

export { Notifications };

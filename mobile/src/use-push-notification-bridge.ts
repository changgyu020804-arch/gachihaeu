import { useCallback, useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import type { WebView as WebViewType, WebViewMessageEvent } from "react-native-webview";
import { isInternalUrl } from "./config";
import {
  acquireExpoPushToken,
  getPushDestination,
  getPushPermissionState,
  hasPushProjectConfiguration,
  Notifications,
  PushDestination,
} from "./push-notifications";
import {
  parseWebBridgeMessage,
  pushDestinationScript,
  pushTokenRegistrationScript,
} from "./webview-bridge";

export function usePushNotificationBridge(
  webViewRef: React.RefObject<WebViewType | null>,
) {
  const webReadyRef = useRef(false);
  const pushTokenRef = useRef<string | null>(null);
  const pendingDestinationRef = useRef<PushDestination | null>(null);
  const permissionPromptShownRef = useRef(false);

  const syncPushTokenToWeb = useCallback(
    (token: string) => {
      pushTokenRef.current = token;
      if (!webReadyRef.current) return;
      webViewRef.current?.injectJavaScript(
        pushTokenRegistrationScript(token, Platform.OS),
      );
    },
    [webViewRef],
  );

  const openPushDestination = useCallback(
    (destination: PushDestination) => {
      if (!webReadyRef.current) {
        pendingDestinationRef.current = destination;
        return;
      }
      pendingDestinationRef.current = null;
      webViewRef.current?.injectJavaScript(pushDestinationScript(destination));
    },
    [webViewRef],
  );

  const registerPushToken = useCallback(
    async (requestPermission: boolean) => {
      const token = await acquireExpoPushToken(requestPermission);
      if (token) syncPushTokenToWeb(token);
    },
    [syncPushTokenToWeb],
  );

  const ensurePushRegistration = useCallback(async () => {
    if (!hasPushProjectConfiguration()) return;
    const permission = await getPushPermissionState();
    if (permission === "granted") {
      await registerPushToken(false);
      return;
    }
    if (
      permission !== "not-determined" ||
      permissionPromptShownRef.current
    ) {
      return;
    }

    permissionPromptShownRef.current = true;
    Alert.alert(
      "모임 소식을 바로 받아볼까요?",
      "신청·댓글·일정 변경 알림을 iPhone으로 보내드려요. 알림을 꺼도 앱은 그대로 사용할 수 있어요.",
      [
        { text: "나중에", style: "cancel" },
        {
          text: "알림 켜기",
          onPress: () => void registerPushToken(true),
        },
      ],
    );
  }, [registerPushToken]);

  useEffect(() => {
    let active = true;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!active) return;
      const destination = getPushDestination(response);
      if (destination) {
        openPushDestination(destination);
        void Notifications.clearLastNotificationResponseAsync();
      }
    });

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const destination = getPushDestination(response);
        if (destination) openPushDestination(destination);
      });
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      void registerPushToken(false);
    });

    return () => {
      active = false;
      responseSubscription.remove();
      tokenSubscription.remove();
    };
  }, [openPushDestination, registerPushToken]);

  const onWebMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (!isInternalUrl(event.nativeEvent.url)) return;
      const message = parseWebBridgeMessage(event.nativeEvent.data);
      if (message?.type === "session" && message.authenticated) {
        void ensurePushRegistration();
      }
    },
    [ensurePushRegistration],
  );

  const markWebReady = useCallback(() => {
    webReadyRef.current = true;
    if (pushTokenRef.current) syncPushTokenToWeb(pushTokenRef.current);
    if (pendingDestinationRef.current) {
      openPushDestination(pendingDestinationRef.current);
    }
  }, [openPushDestination, syncPushTokenToWeb]);

  const markWebUnavailable = useCallback(() => {
    webReadyRef.current = false;
  }, []);

  return { markWebReady, markWebUnavailable, onWebMessage };
}

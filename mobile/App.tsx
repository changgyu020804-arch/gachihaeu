import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";
import { OfflineView } from "./src/components/offline-view";
import {
  APP_URL,
  canOpenOutsideApp,
  isInternalUrl,
} from "./src/services/config";
import { usePushNotificationBridge } from "./src/hooks/use-push-notification-bridge";

export default function App() {
  const webViewRef = useRef<WebViewType>(null);
  const { markWebReady, markWebUnavailable, onWebMessage } =
    usePushNotificationBridge(webViewRef);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    markWebUnavailable();
    setLoadFailed(false);
    setIsLoading(true);
    setReloadKey((current) => current + 1);
  }, [markWebUnavailable]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!canGoBack) return false;
        webViewRef.current?.goBack();
        return true;
      },
    );

    return () => subscription.remove();
  }, [canGoBack]);

  const openExternalUrl = useCallback(async (url: string) => {
    try {
      if (!canOpenOutsideApp(url) || !(await Linking.canOpenURL(url))) {
        throw new Error("unsupported-url");
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "링크를 열 수 없어요",
        "주소를 확인하거나 잠시 후 다시 시도해 주세요.",
      );
    }
  }, []);

  const shouldStartLoading = useCallback(
    (request: { url: string }) => {
      if (isInternalUrl(request.url)) return true;
      void openExternalUrl(request.url);
      return false;
    },
    [openExternalUrl],
  );

  const shareApp = useCallback(async () => {
    try {
      await Share.share({
        title: "같이해U",
        message: `서울시립대 운동 메이트를 같이해U에서 찾아보세요.\n${APP_URL}`,
        url: APP_URL,
      });
    } catch {
      Alert.alert("공유하지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  }, []);

  const onNavigationChange = useCallback((state: WebViewNavigation) => {
    setCanGoBack(state.canGoBack);
  }, []);

  const onWebLoadEnd = useCallback(() => {
    setIsLoading(false);
    markWebReady();
  }, [markWebReady]);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>UOS SPORTS COMMUNITY</Text>
            <Text style={styles.brand}>같이해U</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="같이해U 공유"
            onPress={shareApp}
            style={({ pressed }) => [
              styles.shareButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.shareIcon}>↗</Text>
            <Text style={styles.shareLabel}>공유</Text>
          </Pressable>
        </View>

        <View style={styles.browser}>
          {loadFailed ? (
            <OfflineView onRetry={reload} />
          ) : (
            <>
              <WebView
                key={reloadKey}
                ref={webViewRef}
                source={{ uri: APP_URL }}
                originWhitelist={["https://www.gachihaeu.com", "https://gachihaeu.com"]}
                onShouldStartLoadWithRequest={shouldStartLoading}
                onNavigationStateChange={onNavigationChange}
                onMessage={onWebMessage}
                onLoadStart={() => {
                  markWebUnavailable();
                  setIsLoading(true);
                }}
                onLoadEnd={onWebLoadEnd}
                onError={() => {
                  markWebUnavailable();
                  setIsLoading(false);
                  setLoadFailed(true);
                }}
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                domStorageEnabled
                javaScriptEnabled
                cacheEnabled
                pullToRefreshEnabled
                allowsBackForwardNavigationGestures
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction
                setSupportMultipleWindows={false}
                applicationNameForUserAgent="GachihaeU-iOS/1.0"
                contentInsetAdjustmentBehavior="never"
                style={styles.webView}
              />
              {isLoading && (
                <View style={styles.loading} pointerEvents="none">
                  <View style={styles.loadingCard}>
                    <ActivityIndicator size="small" color="#4771f5" />
                    <Text style={styles.loadingText}>같이할 운동을 찾는 중...</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8ecf3",
    backgroundColor: "#ffffff",
  },
  eyebrow: {
    color: "#4771f5",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.35,
  },
  brand: {
    marginTop: 2,
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  shareButton: {
    minWidth: 72,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: "#eef3ff",
  },
  buttonPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.98 }],
  },
  shareIcon: {
    color: "#4771f5",
    fontSize: 17,
    fontWeight: "800",
  },
  shareLabel: {
    color: "#315de8",
    fontSize: 13,
    fontWeight: "800",
  },
  browser: {
    flex: 1,
    backgroundColor: "#f2f5fa",
  },
  webView: {
    flex: 1,
    backgroundColor: "#f2f5fa",
  },
  loading: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(242, 245, 250, 0.78)",
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    shadowColor: "#1d2a45",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  loadingText: {
    color: "#566176",
    fontSize: 13,
    fontWeight: "700",
  },
});

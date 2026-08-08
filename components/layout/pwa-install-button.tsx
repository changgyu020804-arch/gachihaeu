"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as NavigatorWithStandalone).standalone);
    const detectionTimer = window.setTimeout(() => {
      setIsInstalled(standalone);
      setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
      setIsNativeApp(/GachihaeU-iOS/i.test(navigator.userAgent));
    }, 0);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/service-worker.js").catch(() => {
        // 다음 방문 때 브라우저가 다시 등록한다.
      });
    }

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.clearTimeout(detectionTimer);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (isNativeApp || isInstalled || (!installPrompt && !isIos)) return null;

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
      return;
    }

    window.alert(
      "iPhone에서는 Safari의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해 주세요.",
    );
  };

  return (
    <button
      type="button"
      className="install-app-button"
      onClick={() => void install()}
      aria-label="같이해U 앱 설치"
      title="앱 설치"
    >
      <span aria-hidden="true">↓</span>
      <b>설치</b>
    </button>
  );
}

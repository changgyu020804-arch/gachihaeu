import type { PushDestination } from "./push-notifications";

export type WebBridgeMessage = {
  type: "session";
  authenticated: boolean;
};

export function parseWebBridgeMessage(value: string): WebBridgeMessage | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.type === "session" && typeof parsed.authenticated === "boolean") {
      return { type: "session", authenticated: parsed.authenticated };
    }
  } catch {
    // Ignore malformed messages from web content.
  }
  return null;
}

export function pushTokenRegistrationScript(token: string, platform: string) {
  return `
    (() => {
      const token = ${JSON.stringify(token)};
      fetch('/api/push-tokens', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: ${JSON.stringify(platform)} })
      }).then((response) => {
        if (response.ok) localStorage.setItem('gachihaeu:push-token', token);
      }).catch(() => undefined);
    })();
    true;
  `;
}

export function pushDestinationScript(destination: PushDestination) {
  return `
    (() => {
      const detail = ${JSON.stringify(destination)};
      if (detail.notificationId) {
        fetch('/api/notifications', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: detail.notificationId })
        }).catch(() => undefined);
      }
      if (window.location.pathname === '/') {
        window.dispatchEvent(new CustomEvent('gachihaeu:open-activity', {
          detail: { activityId: detail.activityId }
        }));
      } else {
        window.location.assign('/?activity=' + encodeURIComponent(detail.activityId));
      }
    })();
    true;
  `;
}

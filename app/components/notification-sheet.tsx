"use client";

import { useEffect, useState } from "react";
import { getErrorMessage } from "./utils";

export type AppNotification = {
  id: string;
  activityId: string | null;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationSheetProps = {
  onClose: () => void;
  onUnreadChange: (count: number) => void;
  onOpenNotification: (notification: AppNotification) => void;
};

const TYPE_ICONS: Record<string, string> = {
  joined: "✓",
  participant_joined: "＋",
  participant_left: "−",
  waitlisted: "⏳",
  promoted: "🎉",
  cancelled: "!",
  reminder: "⏰",
  rating: "★",
  attendance: "✓",
  rated: "★",
  notice: "📣",
  comment: "💬",
};

function formatTime(value: string) {
  const date = new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return "방금";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffMinutes < 24 * 60) return `${Math.floor(diffMinutes / 60)}시간 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function NotificationSheet({
  onClose,
  onUnreadChange,
  onOpenNotification,
}: NotificationSheetProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        const payload = (await response.json()) as {
          notifications?: AppNotification[];
          unreadCount?: number;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "알림을 불러오지 못했어요.");
        if (!active) return;
        setNotifications(payload.notifications ?? []);
        onUnreadChange(payload.unreadCount ?? 0);
      } catch (loadError) {
        if (active) setError(getErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [onUnreadChange]);

  const markAllRead = async () => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!response.ok) return;
    setNotifications((items) =>
      items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
    );
    onUnreadChange(0);
  };

  const openNotification = async (notification: AppNotification) => {
    if (!notification.readAt) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      });
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      onUnreadChange(
        notifications.filter((item) => !item.readAt && item.id !== notification.id).length,
      );
    }
    onOpenNotification(notification);
  };

  const hasUnread = notifications.some((notification) => !notification.readAt);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet notification-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header notification-header">
          <div>
            <p className="section-kicker">NOTIFICATIONS</p>
            <h2 id="notification-title">알림</h2>
          </div>
          <div className="notification-header-actions">
            {hasUnread && (
              <button className="mark-all-read" onClick={() => void markAllRead()}>
                모두 읽음
              </button>
            )}
            <button className="close-button" onClick={onClose} aria-label="알림 닫기">
              ×
            </button>
          </div>
        </div>

        <div className="notification-list">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div className="notification-skeleton" key={index} />
            ))
          ) : error ? (
            <div className="notification-empty">
              <span>!</span>
              <p>{error}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <span>🔔</span>
              <strong>새 알림이 없어요</strong>
              <p>모임 소식이 생기면 바로 알려드릴게요.</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                className={`notification-item ${notification.readAt ? "" : "unread"}`}
                onClick={() => void openNotification(notification)}
              >
                <span className={`notification-type type-${notification.type}`}>
                  {TYPE_ICONS[notification.type] ?? "•"}
                </span>
                <span className="notification-copy">
                  <span className="notification-title-row">
                    <strong>{notification.title}</strong>
                    <time>{formatTime(notification.createdAt)}</time>
                  </span>
                  <span>{notification.message}</span>
                </span>
                {!notification.readAt && <i className="unread-dot" aria-label="읽지 않음" />}
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

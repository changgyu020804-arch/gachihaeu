import { Viewer } from "../activity-data";
import { PwaInstallButton } from "./pwa-install-button";

type HomeHeaderProps = {
  user: Viewer | null;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onOpenLogin: () => void;
};

export function HomeHeader({
  user,
  unreadCount,
  onOpenNotifications,
  onOpenProfile,
  onOpenLogin,
}: HomeHeaderProps) {
  return (
    <header className="topbar">
      <div className="brand-lockup" aria-label="같이해U">
        같이해<span>U</span>
      </div>
      <div className="top-actions">
        <span className="campus-badge"><i />서울시립대 베타</span>
        <PwaInstallButton />
        {user ? (
          <>
            <button
              className="notification-button"
              onClick={onOpenNotifications}
              aria-label={`알림 ${unreadCount}개`}
            >
              <span aria-hidden="true">🔔</span>
              {unreadCount > 0 && <b>{unreadCount > 99 ? "99+" : unreadCount}</b>}
            </button>
            <button className="avatar-button" onClick={onOpenProfile}>
              {(user.fullName || user.email).slice(0, 1).toUpperCase()}
            </button>
          </>
        ) : (
          <button className="login-button" onClick={onOpenLogin}>로그인</button>
        )}
      </div>
    </header>
  );
}

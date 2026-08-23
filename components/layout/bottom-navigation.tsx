import { memo } from "react";

export type ActiveNav = "home" | "matches" | "mine" | "profile";

type BottomNavigationProps = {
  activeNav: ActiveNav;
  onHome: () => void;
  onMatches: () => void;
  onCreate: () => void;
  onMine: () => void;
  onProfile: () => void;
};

export const BottomNavigation = memo(function BottomNavigation({
  activeNav,
  onHome,
  onMatches,
  onCreate,
  onMine,
  onProfile,
}: BottomNavigationProps) {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      <button
        className={activeNav === "home" ? "nav-item active" : "nav-item"}
        onClick={onHome}
      >
        <span>⌂</span>홈
      </button>
      <button
        className={activeNav === "matches" ? "nav-item active" : "nav-item"}
        onClick={onMatches}
      >
        <span>⌕</span>모임
      </button>
      <button className="create-button" onClick={onCreate} aria-label="새 모임 만들기">
        +
      </button>
      <button
        className={activeNav === "mine" ? "nav-item active" : "nav-item"}
        onClick={onMine}
      >
        <span>♡</span>내 운동
      </button>
      <button
        className={activeNav === "profile" ? "nav-item active" : "nav-item"}
        onClick={onProfile}
      >
        <span>○</span>MY
      </button>
    </nav>
  );
});

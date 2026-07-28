"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  SPORTS,
  Sport,
  SportFilter,
  Viewer,
} from "./activity-data";
import { createDateFilters, getErrorMessage, localDateKey } from "./components/utils";
import { LoginSheet } from "./components/login-sheet";
import { CreateSheet } from "./components/create-sheet";
import { DetailSheet } from "./components/detail-sheet";
import { ProfileSheet } from "./components/profile-sheet";
import { RatingSheet } from "./components/rating-sheet";
import { UserProfileSheet } from "./components/user-profile-sheet";
import { MatchCard } from "./components/match-card";

type HomeClientProps = {
  initialUser: Viewer | null;
};

export function HomeClient({ initialUser }: HomeClientProps) {
  const [currentUser, setCurrentUser] = useState<Viewer | null>(initialUser);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedSport, setSelectedSport] = useState<SportFilter>("전체");
  const [selectedDate, setSelectedDate] = useState<string>("전체");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [myOnly, setMyOnly] = useState(false);
  const [activeNav, setActiveNav] = useState<"home" | "matches" | "mine" | "profile">("home");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // 평가 시스템
  const [ratingActivityId, setRatingActivityId] = useState<string | null>(null);
  const [viewingUserEmail, setViewingUserEmail] = useState<string | null>(null);

  // 모임 만들기 기본값
  const [createDefaults, setCreateDefaults] = useState<{ sport?: Sport; venue?: string }>({});

  const dateFilters = useMemo(createDateFilters, []);

  // --- 데이터 로딩 ---

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/activities", { cache: "no-store" });
      const payload = (await response.json()) as { activities?: Activity[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "모임을 불러오지 못했어요.");
      setActivities(payload.activities ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // --- 필터링 ---

  const visibleActivities = useMemo(
    () =>
      activities.filter((activity) => {
        const sportMatches = selectedSport === "전체" || activity.sport === selectedSport;
        const dateMatches = selectedDate === "전체" || localDateKey(new Date(activity.startsAt)) === selectedDate;
        const ownerMatches = !myOnly || activity.isOwner || activity.isJoined || activity.isWaitlisted;
        return sportMatches && dateMatches && ownerMatches;
      }),
    [activities, myOnly, selectedDate, selectedSport],
  );

  const stats = useMemo(
    () => ({
      open: activities.length,
      people: activities.reduce((sum, a) => sum + a.participantCount, 0),
      remaining: activities.reduce((sum, a) => sum + Math.max(0, a.capacity - a.participantCount), 0),
    }),
    [activities],
  );

  // --- 액션 핸들러 ---

  const requireLogin = (callback: () => void) => {
    if (!currentUser) {
      setShowLogin(true);
      return;
    }
    callback();
  };

  const openCreate = (sport?: Sport, venue?: string) => {
    requireLogin(() => {
      setCreateDefaults({ sport, venue });
      setShowCreate(true);
    });
  };

  const performAction = async (path: string, method: "POST" | "DELETE", successMessage: string, body?: unknown) => {
    if (!currentUser) { setShowLogin(true); return; }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "요청을 처리하지 못했어요.");
      setToast(successMessage);
      setSelectedActivity(null);
      await loadActivities();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setSubmitting(false);
    }
  };

  const openRating = (activityId: string) => {
    requireLogin(() => setRatingActivityId(activityId));
  };

  const reportActivity = async (activity: Activity) => {
    if (!window.confirm("이 모임을 부적절한 콘텐츠로 신고할까요?")) return;
    await performAction(`/api/activities/${activity.id}/report`, "POST", "신고가 접수됐어요.", { reason: "부적절한 모임 정보" });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setShowProfile(false);
    setToast("로그아웃 되었어요.");
  };

  // --- 렌더링 ---

  return (
    <main className="page-shell">
      <div className="app-frame">
        {/* 상단 헤더 */}
        <header className="topbar">
          <div className="brand-lockup" aria-label="같이해U">같이해<span>U</span></div>
          <div className="top-actions">
            <span className="campus-badge"><i />서울시립대 베타</span>
            {currentUser ? (
              <button className="avatar-button" onClick={() => setShowProfile(true)}>
                {(currentUser.fullName || currentUser.email).slice(0, 1).toUpperCase()}
              </button>
            ) : (
              <button className="login-button" onClick={() => setShowLogin(true)}>로그인</button>
            )}
          </div>
        </header>

        {/* 히어로 */}
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">서울시립대 운동 메이트</p>
            <h1>운동하고 싶은 순간,<br /><span>같이해U</span></h1>
            <p className="hero-description">교내에서 열리는 운동 모임을 찾고<br />빈자리에 바로 참여해 보세요.</p>
          </div>
          <div className="hero-score" aria-label={`열린 모임 ${stats.open}개`}>
            <span>오늘의 캠퍼스</span>
            <strong>{stats.open}</strong>
            <small>개의 열린 모임</small>
          </div>
          <div className="hero-stats">
            <span><b>{stats.people}</b>명 참여 중</span>
            <i />
            <span><b>{stats.remaining}</b>자리 남음</span>
          </div>
        </section>

        {/* 장소별 모임 */}
        <section className="venue-list-section">
          <div className="section-title-row">
            <div>
              <p className="section-kicker">CAMPUS VENUES</p>
              <h2>장소별 모임</h2>
            </div>
          </div>
          <div className="venue-list">
            {([
              { venue: "축구장", sport: "축구" as const, icon: "⚽" },
              { venue: "실외농구장", sport: "농구" as const, icon: "🏀" },
              { venue: "족구장", sport: "축구" as const, icon: "🦶" },
              { venue: "실외테니스장", sport: "테니스" as const, icon: "🎾" },
              { venue: "실내테니스장", sport: "테니스" as const, icon: "🎾" },
              { venue: "스쿼시장", sport: "배드민턴" as const, icon: "🏸" },
              { venue: "100주년 기념관 농구장", sport: "농구" as const, icon: "🏀" },
              { venue: "100주년 기념관 배드민턴장", sport: "배드민턴" as const, icon: "🏸" },
              { venue: "100주년 기념관 배구장", sport: "배드민턴" as const, icon: "🏐" },
            ]).map((item) => {
              const count = activities.filter((a) => a.venue === item.venue).length;
              return (
                <button
                  key={item.venue}
                  className={`venue-list-item ${count > 0 ? "has-activities" : ""}`}
                  onClick={() => {
                    setSelectedSport(item.sport);
                    document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <span className="venue-list-icon">{item.icon}</span>
                  <span className="venue-list-name">{item.venue}</span>
                  <span className={`venue-list-count ${count > 0 ? "active" : ""}`}>{count}개 모임</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 모임 목록 */}
        <section className="matches-section" id="matches">
          <div className="section-title-row match-heading">
            <div>
              <p className="section-kicker">{myOnly ? "MY ACTIVITIES" : "UPCOMING"}</p>
              <h2>{myOnly ? "내가 참여한 모임" : "다가오는 모임"}</h2>
            </div>
            <span className="match-count">{visibleActivities.length}개</span>
          </div>

          <div className="filter-row">
            <button
              className={`filter-pill ${selectedDate === "전체" ? "active" : ""}`}
              onClick={() => setSelectedDate("전체")}
            >전체</button>
            {dateFilters.map((d) => (
              <button
                key={d.key}
                className={`date-pill ${selectedDate === d.key ? "active" : ""}`}
                onClick={() => setSelectedDate(d.key)}
              >
                <span>{d.label}</span>
                <strong>{d.day}</strong>
              </button>
            ))}
          </div>

          <div className="active-filter-row">
            <div className="sport-pills">
              {SPORTS.map((sport) => (
                <button key={sport} className={selectedSport === sport ? "active" : ""} onClick={() => setSelectedSport(sport)}>
                  {sport}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => void loadActivities()}>다시 시도</button>
            </div>
          )}

          <div className="match-list">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <div className="match-skeleton" key={i} />)
            ) : visibleActivities.length > 0 ? (
              visibleActivities.map((activity) => (
                <MatchCard
                  key={activity.id}
                  activity={activity}
                  submitting={submitting}
                  onSelect={setSelectedActivity}
                  onPerformAction={(path, method, msg) => void performAction(path, method, msg)}
                  onOpenRating={openRating}
                />
              ))
            ) : (
              <div className="empty-state">
                <span>🙌</span>
                <h3>{myOnly ? "참여한 모임이 아직 없어요" : "조건에 맞는 모임이 없어요"}</h3>
                <p>{myOnly ? "마음에 드는 모임에 참가해 보세요." : "첫 번째 모임을 열어 친구들을 모아보세요."}</p>
                <button onClick={() => (myOnly ? setMyOnly(false) : openCreate())}>
                  {myOnly ? "모임 둘러보기" : "모임 만들기"}
                </button>
              </div>
            )}
          </div>

          <aside className="safety-note">
            <span>🛡️</span>
            <div>
              <strong>모두가 즐거운 같이해U</strong>
              <p>연락처는 공개하지 말고, 정해진 교내 장소에서 서로를 배려해 주세요.</p>
            </div>
          </aside>
        </section>

        {/* 하단 네비게이션 */}
        <nav className="bottom-nav" aria-label="주요 메뉴">
          <button
            className={activeNav === "home" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setActiveNav("home");
              setMyOnly(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <span>⌂</span>홈
          </button>
          <button
            className={activeNav === "matches" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setActiveNav("matches");
              setMyOnly(false);
              document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span>⌕</span>모임
          </button>
          <button className="create-button" onClick={() => openCreate()} aria-label="새 모임 만들기">+</button>
          <button
            className={activeNav === "mine" ? "nav-item active" : "nav-item"}
            onClick={() => requireLogin(() => {
              setActiveNav("mine");
              setMyOnly(true);
              document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
            })}
          >
            <span>♡</span>내 운동
          </button>
          <button
            className={activeNav === "profile" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setActiveNav("profile");
              currentUser ? setShowProfile(true) : setShowLogin(true);
            }}
          >
            <span>○</span>MY
          </button>
        </nav>

        {/* 모달들 */}
        {showLogin && (
          <LoginSheet
            onClose={() => setShowLogin(false)}
            onLogin={(user) => {
              setCurrentUser(user);
              setShowLogin(false);
              setToast("로그인 되었어요! 환영합니다.");
              void loadActivities();
            }}
          />
        )}

        {showCreate && (
          <CreateSheet
            onClose={() => setShowCreate(false)}
            onCreated={() => void loadActivities()}
            onToast={setToast}
            defaultSport={createDefaults.sport}
            defaultVenue={createDefaults.venue}
          />
        )}

        {selectedActivity && (
          <DetailSheet
            activity={selectedActivity}
            submitting={submitting}
            onClose={() => setSelectedActivity(null)}
            onPerformAction={(path, method, msg, body) => void performAction(path, method, msg, body)}
            onOpenRating={openRating}
            onReport={(a) => void reportActivity(a)}
          />
        )}

        {showProfile && currentUser && (
          <ProfileSheet
            user={currentUser}
            activities={activities}
            onClose={() => setShowProfile(false)}
            onLogout={() => void handleLogout()}
            onToast={setToast}
          />
        )}

        {ratingActivityId && currentUser && (
          <RatingSheet
            activityId={ratingActivityId}
            currentUserEmail={currentUser.email}
            onClose={() => setRatingActivityId(null)}
            onToast={setToast}
            onViewProfile={setViewingUserEmail}
          />
        )}

        {viewingUserEmail && (
          <UserProfileSheet
            email={viewingUserEmail}
            onClose={() => setViewingUserEmail(null)}
          />
        )}

        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </main>
  );
}

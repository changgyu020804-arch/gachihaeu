"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  LEVELS,
  SPORT_META,
  SPORTS,
  Sport,
  SportFilter,
  VENUES,
  Viewer,
} from "./activity-data";

type HomeClientProps = {
  initialUser: Viewer | null;
  signInPath: string;
  signOutPath: string;
};

type CreateForm = {
  sport: Sport;
  title: string;
  venue: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  level: string;
  description: string;
};

const initialForm: CreateForm = {
  sport: "농구",
  title: "",
  venue: "대운동장 북측 농구장",
  startsAt: "",
  durationMinutes: 90,
  capacity: 6,
  level: "초보 환영",
  description: "",
};

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultStartTime() {
  const date = new Date();
  date.setHours(date.getHours() + 2, 0, 0, 0);
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function createDateFilters() {
  const formatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      key: localDateKey(date),
      label: index === 0 ? "오늘" : index === 1 ? "내일" : formatter.format(date),
      day: date.getDate(),
    };
  });
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.";
}

export function HomeClient({ initialUser, signInPath, signOutPath }: HomeClientProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedSport, setSelectedSport] = useState<SportFilter>("전체");
  const [selectedDate, setSelectedDate] = useState<string>("전체");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [myOnly, setMyOnly] = useState(false);
  const [form, setForm] = useState<CreateForm>({
    ...initialForm,
    startsAt: defaultStartTime(),
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const dateFilters = useMemo(createDateFilters, []);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/activities", { cache: "no-store" });
      const payload = (await response.json()) as {
        activities?: Activity[];
        error?: string;
      };
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

  const visibleActivities = useMemo(
    () =>
      activities.filter((activity) => {
        const sportMatches =
          selectedSport === "전체" || activity.sport === selectedSport;
        const dateMatches =
          selectedDate === "전체" ||
          localDateKey(new Date(activity.startsAt)) === selectedDate;
        const ownerMatches = !myOnly || activity.isOwner || activity.isJoined;
        return sportMatches && dateMatches && ownerMatches;
      }),
    [activities, myOnly, selectedDate, selectedSport],
  );

  const openCreate = (sport?: Sport, venue?: string) => {
    if (!initialUser) {
      window.location.href = signInPath;
      return;
    }
    setForm((current) => ({
      ...current,
      sport: sport ?? current.sport,
      venue: venue ?? current.venue,
      startsAt: defaultStartTime(),
    }));
    setShowCreate(true);
  };

  const performAction = async (
    path: string,
    method: "POST" | "DELETE",
    successMessage: string,
    body?: unknown,
  ) => {
    if (!initialUser) {
      window.location.href = signInPath;
      return;
    }
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

  const submitActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "모임을 만들지 못했어요.");
      setShowCreate(false);
      setForm({ ...initialForm, startsAt: defaultStartTime() });
      setToast("모임을 만들었어요. 이제 친구들을 기다려 볼까요?");
      await loadActivities();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const reportActivity = async (activity: Activity) => {
    if (!window.confirm("이 모임을 부적절한 콘텐츠로 신고할까요?")) return;
    await performAction(
      `/api/activities/${activity.id}/report`,
      "POST",
      "신고가 접수됐어요.",
      { reason: "부적절한 모임 정보" },
    );
  };

  const stats = useMemo(
    () => ({
      open: activities.length,
      people: activities.reduce((sum, activity) => sum + activity.participantCount, 0),
      remaining: activities.reduce(
        (sum, activity) =>
          sum + Math.max(0, activity.capacity - activity.participantCount),
        0,
      ),
    }),
    [activities],
  );

  return (
    <main className="page-shell">
      <div className="app-frame">
        <header className="topbar">
          <div className="brand-lockup" aria-label="같이해U">
            같이해<span>U</span>
          </div>
          <div className="top-actions">
            <span className="campus-badge">
              <i />
              서울시립대 베타
            </span>
            {initialUser ? (
              <button className="avatar-button" onClick={() => setShowProfile(true)}>
                {(initialUser.fullName || initialUser.email).slice(0, 1).toUpperCase()}
              </button>
            ) : (
              <a className="login-button" href={signInPath}>
                로그인
              </a>
            )}
          </div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">서울시립대 운동 메이트</p>
            <h1>
              운동하고 싶은 순간,
              <br />
              <span>같이해U</span>
            </h1>
            <p className="hero-description">
              교내에서 열리는 운동 모임을 찾고
              <br />
              빈자리에 바로 참여해 보세요.
            </p>
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

        <section className="quick-section" aria-label="운동 종목 선택">
          <div className="section-title-row">
            <div>
              <p className="section-kicker">QUICK START</p>
              <h2>어떤 운동을 할까요?</h2>
            </div>
          </div>
          <div className="sport-grid">
            {SPORTS.filter((sport): sport is Sport => sport !== "전체").map((sport) => (
              <button
                key={sport}
                className={`sport-card ${selectedSport === sport ? "active" : ""}`}
                onClick={() =>
                  setSelectedSport((current) => (current === sport ? "전체" : sport))
                }
              >
                <span
                  className="sport-emoji"
                  style={{ background: SPORT_META[sport].softColor }}
                >
                  {SPORT_META[sport].icon}
                </span>
                <strong>{sport}</strong>
                <small>
                  {activities.filter((activity) => activity.sport === sport).length}개 모임
                </small>
              </button>
            ))}
          </div>
        </section>

        <section className="campus-map-section">
          <div className="section-title-row">
            <div>
              <p className="section-kicker">CAMPUS PLAY MAP</p>
              <h2>장소에서 바로 찾아봐요</h2>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setSelectedSport("전체");
                setSelectedDate("전체");
              }}
            >
              초기화
            </button>
          </div>

          <div className="campus-map">
            <div className="map-road road-horizontal" />
            <div className="map-road road-vertical" />
            <div className="map-building building-one">100주년<br />기념관</div>
            <div className="map-building building-two">학생회관</div>
            <div className="map-field main-field"><span>대운동장</span></div>
            <div className="map-field basketball-courts" />
            <div className="map-field small-field" />
            <div className="map-field tennis-courts" />

            <button
              className="venue-pin venue-basketball"
              onClick={() => {
                setSelectedSport("농구");
                document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <strong>{activities.filter((item) => item.sport === "농구").length}</strong>
              <span>농구장</span>
            </button>
            <button
              className="venue-pin venue-main"
              onClick={() => {
                setSelectedSport("러닝");
                document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <strong>{activities.filter((item) => item.sport === "러닝").length}</strong>
              <span>대운동장</span>
            </button>
            <button
              className="venue-pin venue-football"
              onClick={() => {
                setSelectedSport("축구");
                document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <strong>{activities.filter((item) => item.sport === "축구").length}</strong>
              <span>축구장</span>
            </button>
            <button
              className="venue-pin venue-tennis"
              onClick={() => {
                setSelectedSport("테니스");
                document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <strong>{activities.filter((item) => item.sport === "테니스").length}</strong>
              <span>테니스장</span>
            </button>
            <button
              className="venue-pin venue-wellness"
              onClick={() => {
                setSelectedSport("헬스");
                document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
              }}
              aria-label="웰니스센터 헬스 모임 보기"
            >
              <strong>{activities.filter((item) => item.sport === "헬스").length}</strong>
              <span>웰니스</span>
            </button>
            <button
              className="map-create-button"
              onClick={() => openCreate("헬스", "웰니스센터 피트니스룸")}
            >
              + 웰니스 메이트 모집
            </button>
          </div>
        </section>

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
            >
              전체
            </button>
            {dateFilters.map((date) => (
              <button
                key={date.key}
                className={`date-pill ${selectedDate === date.key ? "active" : ""}`}
                onClick={() => setSelectedDate(date.key)}
              >
                <span>{date.label}</span>
                <strong>{date.day}</strong>
              </button>
            ))}
          </div>

          <div className="active-filter-row">
            <div className="sport-pills">
              {SPORTS.map((sport) => (
                <button
                  key={sport}
                  className={selectedSport === sport ? "active" : ""}
                  onClick={() => setSelectedSport(sport)}
                >
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
              Array.from({ length: 3 }).map((_, index) => (
                <div className="match-skeleton" key={index} />
              ))
            ) : visibleActivities.length > 0 ? (
              visibleActivities.map((activity) => {
                const meta = SPORT_META[activity.sport];
                const left = activity.capacity - activity.participantCount;
                return (
                  <article
                    className="match-card"
                    key={activity.id}
                    onClick={() => setSelectedActivity(activity)}
                  >
                    <div className="match-topline">
                      <span
                        className="sport-label"
                        style={{ color: meta.color, background: meta.softColor }}
                      >
                        {meta.icon} {activity.sport}
                      </span>
                      {activity.isOwner && <span className="owner-label">내가 만든 모임</span>}
                    </div>
                    <div className="match-main">
                      <div className="match-date">
                        <strong>{formatTime(activity.startsAt)}</strong>
                        <span>{formatShortDate(activity.startsAt)}</span>
                      </div>
                      <div className="match-copy">
                        <h3>{activity.title}</h3>
                        <p>{activity.venue}</p>
                        <div className="match-meta">
                          <span>{activity.level}</span>
                          <span>{activity.durationMinutes}분</span>
                          <span className={left <= 1 ? "urgent" : ""}>
                            {left === 0 ? "모집 완료" : `${left}자리 남음`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="match-footer">
                      <div className="host-info">
                        <span>{activity.creatorName.slice(0, 1)}</span>
                        <p>
                          <b>{activity.creatorName}</b>
                          <small>{activity.participantCount}/{activity.capacity}명 참여</small>
                        </p>
                      </div>
                      <button
                        className={`join-button ${activity.isJoined ? "joined" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (activity.isOwner) {
                            setSelectedActivity(activity);
                            return;
                          }
                          void performAction(
                            `/api/activities/${activity.id}/join`,
                            activity.isJoined ? "DELETE" : "POST",
                            activity.isJoined ? "참가를 취소했어요." : "참가가 완료됐어요!",
                          );
                        }}
                        disabled={submitting || (left === 0 && !activity.isJoined)}
                      >
                        {activity.isOwner
                          ? "관리하기"
                          : activity.isJoined
                            ? "참가 완료"
                            : left === 0
                              ? "마감"
                              : "같이하기"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
                <span>🙌</span>
                <h3>{myOnly ? "참여한 모임이 아직 없어요" : "조건에 맞는 모임이 없어요"}</h3>
                <p>
                  {myOnly
                    ? "마음에 드는 모임에 참가해 보세요."
                    : "첫 번째 모임을 열어 친구들을 모아보세요."}
                </p>
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

        <nav className="bottom-nav" aria-label="주요 메뉴">
          <button
            className={!myOnly ? "nav-item active" : "nav-item"}
            onClick={() => {
              setMyOnly(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <span>⌂</span>
            홈
          </button>
          <button
            className="nav-item"
            onClick={() => document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" })}
          >
            <span>◎</span>
            모임찾기
          </button>
          <button className="create-button" onClick={() => openCreate()} aria-label="새 모임 만들기">
            +
          </button>
          <button
            className={myOnly ? "nav-item active" : "nav-item"}
            onClick={() => {
              if (!initialUser) {
                window.location.href = signInPath;
                return;
              }
              setMyOnly(true);
              document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span>♡</span>
            내 운동
          </button>
          <button
            className="nav-item"
            onClick={() => (initialUser ? setShowProfile(true) : (window.location.href = signInPath))}
          >
            <span>○</span>
            MY
          </button>
        </nav>

        {showCreate && (
          <div className="sheet-backdrop" onClick={() => setShowCreate(false)}>
            <section
              className="sheet create-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle" />
              <div className="sheet-header">
                <div>
                  <p className="section-kicker">NEW ACTIVITY</p>
                  <h2 id="create-title">새 모임 만들기</h2>
                </div>
                <button className="close-button" onClick={() => setShowCreate(false)}>×</button>
              </div>
              <form onSubmit={submitActivity}>
                <fieldset>
                  <legend>운동 종목</legend>
                  <div className="choice-grid">
                    {SPORTS.filter((sport): sport is Sport => sport !== "전체").map((sport) => (
                      <button
                        type="button"
                        key={sport}
                        className={form.sport === sport ? "active" : ""}
                        onClick={() => setForm((current) => ({ ...current, sport }))}
                      >
                        {SPORT_META[sport].icon} {sport}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  모임 제목
                  <input
                    required
                    minLength={2}
                    maxLength={50}
                    value={form.title}
                    placeholder="예: 수업 끝나고 가볍게 농구해요"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>
                <div className="form-row">
                  <label>
                    날짜와 시간
                    <input
                      required
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, startsAt: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    진행 시간
                    <select
                      value={form.durationMinutes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          durationMinutes: Number(event.target.value),
                        }))
                      }
                    >
                      <option value={60}>60분</option>
                      <option value={90}>90분</option>
                      <option value={120}>120분</option>
                    </select>
                  </label>
                </div>
                <label>
                  장소
                  <select
                    value={form.venue}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, venue: event.target.value }))
                    }
                  >
                    {VENUES.map((venue) => <option key={venue}>{venue}</option>)}
                  </select>
                </label>
                <div className="form-row">
                  <label>
                    최대 인원
                    <input
                      required
                      type="number"
                      min={2}
                      max={30}
                      value={form.capacity}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          capacity: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    난이도
                    <select
                      value={form.level}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, level: event.target.value }))
                      }
                    >
                      {LEVELS.map((level) => <option key={level}>{level}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  상세 설명
                  <textarea
                    maxLength={280}
                    value={form.description}
                    placeholder="준비물이나 모임 방법을 알려주세요. 연락처는 적지 마세요."
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                  <small>{form.description.length}/280</small>
                </label>
                <div className="community-check">
                  <span>✓</span>
                  교내 시설 이용수칙과 커뮤니티 매너를 지킬게요.
                </div>
                <button className="primary-button" disabled={submitting}>
                  {submitting ? "등록하는 중..." : "모임 등록하기"}
                </button>
              </form>
            </section>
          </div>
        )}

        {selectedActivity && (
          <div className="sheet-backdrop" onClick={() => setSelectedActivity(null)}>
            <section
              className="sheet detail-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle" />
              <div className="sheet-header">
                <span
                  className="detail-sport-icon"
                  style={{ background: SPORT_META[selectedActivity.sport].softColor }}
                >
                  {SPORT_META[selectedActivity.sport].icon}
                </span>
                <button className="close-button" onClick={() => setSelectedActivity(null)}>×</button>
              </div>
              <span className="detail-label">{selectedActivity.sport} · {selectedActivity.level}</span>
              <h2 id="detail-title">{selectedActivity.title}</h2>
              <div className="detail-info">
                <p><span>날짜</span><strong>{formatFullDate(selectedActivity.startsAt)}</strong></p>
                <p><span>장소</span><strong>{selectedActivity.venue}</strong></p>
                <p><span>시간</span><strong>{selectedActivity.durationMinutes}분</strong></p>
                <p><span>인원</span><strong>{selectedActivity.participantCount}/{selectedActivity.capacity}명</strong></p>
              </div>
              {selectedActivity.description && (
                <div className="detail-description">{selectedActivity.description}</div>
              )}
              <div className="detail-host">
                <span>{selectedActivity.creatorName.slice(0, 1)}</span>
                <div><small>모임장</small><strong>{selectedActivity.creatorName}</strong></div>
              </div>
              {selectedActivity.isOwner ? (
                <button
                  className="danger-button"
                  disabled={submitting}
                  onClick={() => {
                    if (!window.confirm("모임을 취소할까요? 참가자 목록에서도 사라집니다.")) return;
                    void performAction(
                      `/api/activities/${selectedActivity.id}`,
                      "DELETE",
                      "모임을 취소했어요.",
                    );
                  }}
                >
                  모임 취소하기
                </button>
              ) : (
                <div className="detail-actions">
                  <button
                    className="report-button"
                    onClick={() => void reportActivity(selectedActivity)}
                  >
                    신고
                  </button>
                  <button
                    className={`primary-button ${selectedActivity.isJoined ? "soft" : ""}`}
                    disabled={
                      submitting ||
                      (selectedActivity.participantCount >= selectedActivity.capacity &&
                        !selectedActivity.isJoined)
                    }
                    onClick={() =>
                      void performAction(
                        `/api/activities/${selectedActivity.id}/join`,
                        selectedActivity.isJoined ? "DELETE" : "POST",
                        selectedActivity.isJoined ? "참가를 취소했어요." : "참가가 완료됐어요!",
                      )
                    }
                  >
                    {selectedActivity.isJoined ? "참가 취소" : "같이하기"}
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {showProfile && initialUser && (
          <div className="sheet-backdrop" onClick={() => setShowProfile(false)}>
            <section
              className="sheet profile-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle" />
              <div className="profile-avatar">
                {(initialUser.fullName || initialUser.email).slice(0, 1).toUpperCase()}
              </div>
              <p>같이해U 베타 멤버</p>
              <h2 id="profile-title">{initialUser.fullName || initialUser.displayName}</h2>
              <small>{initialUser.email}</small>
              <div className="profile-stats">
                <div><strong>{activities.filter((item) => item.isJoined).length}</strong><span>참여 모임</span></div>
                <div><strong>{activities.filter((item) => item.isOwner).length}</strong><span>만든 모임</span></div>
              </div>
              <p className="verification-note">
                공식 서울시립대 학생 인증은 학교 시스템 연동 후 제공될 예정입니다.
              </p>
              <a className="signout-link" href={signOutPath}>로그아웃</a>
            </section>
          </div>
        )}

        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </main>
  );
}

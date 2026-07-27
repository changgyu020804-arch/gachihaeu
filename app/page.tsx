"use client";

import { useMemo, useState } from "react";

type Sport = "전체" | "축구" | "농구" | "러닝" | "테니스";

type Match = {
  id: number;
  sport: Exclude<Sport, "전체">;
  icon: string;
  day: "오늘" | "내일" | "수" | "목";
  time: string;
  title: string;
  venue: string;
  level: string;
  current: number;
  capacity: number;
  accent: string;
};

const sports: { name: Sport; icon: string }[] = [
  { name: "전체", icon: "✦" },
  { name: "축구", icon: "⚽" },
  { name: "농구", icon: "🏀" },
  { name: "러닝", icon: "🏃" },
  { name: "테니스", icon: "🎾" },
];

const dates = [
  { day: "오늘", date: "27", weekday: "월" },
  { day: "내일", date: "28", weekday: "화" },
  { day: "수", date: "29", weekday: "수" },
  { day: "목", date: "30", weekday: "목" },
] as const;

const initialMatches: Match[] = [
  {
    id: 1,
    sport: "농구",
    icon: "🏀",
    day: "오늘",
    time: "19:00",
    title: "수업 끝나고 가볍게 3대3",
    venue: "대운동장 북측 농구장",
    level: "초보 환영",
    current: 3,
    capacity: 6,
    accent: "#ff8a34",
  },
  {
    id: 2,
    sport: "러닝",
    icon: "🏃",
    day: "오늘",
    time: "20:00",
    title: "같이 뛰는 5km 저녁 러닝",
    venue: "대운동장 트랙",
    level: "6′00″ 페이스",
    current: 2,
    capacity: 5,
    accent: "#2979ff",
  },
  {
    id: 3,
    sport: "축구",
    icon: "⚽",
    day: "내일",
    time: "18:30",
    title: "퇴근 아닌 하교 풋살",
    venue: "대운동장 서측 축구장",
    level: "누구나",
    current: 7,
    capacity: 10,
    accent: "#19a66a",
  },
  {
    id: 4,
    sport: "테니스",
    icon: "🎾",
    day: "수",
    time: "17:00",
    title: "랠리 연습 파트너 구해요",
    venue: "실외테니스장",
    level: "입문",
    current: 1,
    capacity: 2,
    accent: "#7c5cff",
  },
];

const venues = [
  { name: "농구장", sport: "농구" as Sport, className: "venue-basketball", count: 1 },
  { name: "대운동장", sport: "러닝" as Sport, className: "venue-main", count: 1 },
  { name: "축구장", sport: "축구" as Sport, className: "venue-football", count: 1 },
  { name: "테니스장", sport: "테니스" as Sport, className: "venue-tennis", count: 1 },
];

export default function Home() {
  const [selectedSport, setSelectedSport] = useState<Sport>("전체");
  const [selectedDay, setSelectedDay] = useState<(typeof dates)[number]["day"]>("오늘");
  const [joined, setJoined] = useState<number[]>([]);
  const [showNotice, setShowNotice] = useState(false);

  const visibleMatches = useMemo(
    () =>
      initialMatches.filter(
        (match) =>
          (selectedSport === "전체" || match.sport === selectedSport) &&
          match.day === selectedDay,
      ),
    [selectedDay, selectedSport],
  );

  const handleJoin = (id: number) => {
    setJoined((current) =>
      current.includes(id) ? current.filter((matchId) => matchId !== id) : [...current, id],
    );
  };

  const selectVenue = (sport: Sport) => {
    setSelectedSport(sport);
    setSelectedDay("오늘");
  };

  return (
    <main className="page-shell">
      <div className="app-frame">
        <header className="topbar">
          <button className="campus-selector" aria-label="현재 캠퍼스 선택">
            <span className="location-dot" />
            서울시립대학교
            <span aria-hidden="true" className="chevron">⌄</span>
          </button>
          <button className="icon-button" aria-label="알림">
            <span aria-hidden="true">♢</span>
            <span className="notification-dot" />
          </button>
        </header>

        <section className="hero">
          <p className="eyebrow">같이하면, 오늘도 운동 완료</p>
          <h1>
            오늘은 누구와
            <br />
            <span>같이해U?</span>
          </h1>
          <div className="hero-stats">
            <span><b>7</b>개의 모임</span>
            <i />
            <span><b>18</b>명이 참여 중</span>
          </div>
        </section>

        <section className="sport-section" aria-label="운동 종목 선택">
          <div className="sport-list">
            {sports.map((sport) => (
              <button
                key={sport.name}
                className={`sport-chip ${selectedSport === sport.name ? "active" : ""}`}
                onClick={() => setSelectedSport(sport.name)}
                aria-pressed={selectedSport === sport.name}
              >
                <span>{sport.icon}</span>
                {sport.name}
              </button>
            ))}
          </div>
        </section>

        <section className="campus-map-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">CAMPUS PLAY MAP</p>
              <h2>지금 학교에서는</h2>
            </div>
            <button className="text-button" onClick={() => setSelectedSport("전체")}>
              전체보기
            </button>
          </div>

          <div className="campus-map" aria-label="서울시립대학교 운동시설 지도">
            <div className="map-road road-horizontal" />
            <div className="map-road road-vertical" />
            <div className="map-building building-one">100주년<br />기념관</div>
            <div className="map-building building-two">학생회관</div>
            <div className="map-field main-field">
              <span>대운동장</span>
            </div>
            <div className="map-field basketball-courts" />
            <div className="map-field small-field" />
            <div className="map-field tennis-courts" />

            {venues.map((venue) => (
              <button
                key={venue.name}
                className={`venue-pin ${venue.className}`}
                onClick={() => selectVenue(venue.sport)}
                aria-label={`${venue.name}, 진행 중인 모임 ${venue.count}개`}
              >
                <strong>{venue.count}</strong>
                <span>{venue.name}</span>
              </button>
            ))}

            <div className="map-caption">
              <span className="live-dot" />
              오늘 열리는 모임
            </div>
          </div>
        </section>

        <section className="matches-section">
          <div className="section-heading match-heading">
            <div>
              <p className="section-kicker">UPCOMING</p>
              <h2>다가오는 모임</h2>
            </div>
            <span className="match-count">{visibleMatches.length}개</span>
          </div>

          <div className="date-tabs" role="tablist" aria-label="날짜 선택">
            {dates.map((item) => (
              <button
                key={item.date}
                role="tab"
                aria-selected={selectedDay === item.day}
                className={`date-tab ${selectedDay === item.day ? "active" : ""}`}
                onClick={() => setSelectedDay(item.day)}
              >
                <span>{item.weekday}</span>
                <strong>{item.date}</strong>
              </button>
            ))}
          </div>

          <div className="match-list">
            {visibleMatches.length > 0 ? (
              visibleMatches.map((match) => {
                const isJoined = joined.includes(match.id);
                const current = match.current + (isJoined ? 1 : 0);
                const left = match.capacity - current;

                return (
                  <article className="match-card" key={match.id}>
                    <div className="match-time">
                      <strong>{match.time}</strong>
                      <span>{match.day}</span>
                    </div>
                    <div
                      className="sport-icon"
                      style={{ backgroundColor: `${match.accent}18`, color: match.accent }}
                      aria-hidden="true"
                    >
                      {match.icon}
                    </div>
                    <div className="match-copy">
                      <div className="match-tags">
                        <span style={{ color: match.accent }}>{match.sport}</span>
                        <span>{match.level}</span>
                      </div>
                      <h3>{match.title}</h3>
                      <p>{match.venue}</p>
                      <div className="capacity-row">
                        <div className="avatar-stack" aria-hidden="true">
                          {Array.from({ length: Math.min(current, 4) }).map((_, index) => (
                            <span key={index}>{["민", "수", "지", "나"][index]}</span>
                          ))}
                        </div>
                        <span className={left <= 1 ? "urgent" : ""}>
                          {left === 0 ? "모집 완료" : `${left}자리 남음`}
                        </span>
                      </div>
                    </div>
                    <button
                      className={`join-button ${isJoined ? "joined" : ""}`}
                      onClick={() => handleJoin(match.id)}
                      disabled={!isJoined && left === 0}
                    >
                      {isJoined ? "참가 완료" : left === 0 ? "마감" : "같이하기"}
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
                <span>🏃‍♀️</span>
                <h3>아직 예정된 모임이 없어요</h3>
                <p>첫 번째 모임을 직접 만들어 보세요.</p>
                <button onClick={() => setShowNotice(true)}>모임 만들기</button>
              </div>
            )}
          </div>
        </section>

        <nav className="bottom-nav" aria-label="주요 메뉴">
          <button className="nav-item active">
            <span aria-hidden="true">⌂</span>
            홈
          </button>
          <button className="nav-item">
            <span aria-hidden="true">◎</span>
            모임찾기
          </button>
          <button
            className="create-button"
            onClick={() => setShowNotice(true)}
            aria-label="새 모임 만들기"
          >
            +
          </button>
          <button className="nav-item">
            <span aria-hidden="true">♡</span>
            내 운동
          </button>
          <button className="nav-item">
            <span aria-hidden="true">○</span>
            MY
          </button>
        </nav>

        {showNotice && (
          <div className="sheet-backdrop" role="presentation" onClick={() => setShowNotice(false)}>
            <section
              className="create-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle" />
              <span className="sheet-icon">🙌</span>
              <h2 id="create-title">새 모임을 만들어 볼까요?</h2>
              <p>다음 화면에서 운동, 장소, 시간을 선택하게 됩니다.</p>
              <button onClick={() => setShowNotice(false)}>좋아요</button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

import { memo } from "react";

type HomeHeroProps = {
  openCount: number;
  participantCount: number;
  remainingCount: number;
};

export const HomeHero = memo(function HomeHero({
  openCount,
  participantCount,
  remainingCount,
}: HomeHeroProps) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">서울시립대 운동 메이트</p>
        <h1>운동하고 싶은 순간,<br /><span>같이해U</span></h1>
        <p className="hero-description">
          교내에서 열리는 운동 모임을 찾고<br />빈자리에 바로 참여해 보세요.
        </p>
      </div>
      <div className="hero-score" aria-label={`열린 모임 ${openCount}개`}>
        <span>캠퍼스 전체</span>
        <strong>{openCount}</strong>
        <small>개의 열린 모임</small>
      </div>
      <div className="hero-stats">
        <span><b>{participantCount}</b>명 참여 중</span>
        <i />
        <span><b>{remainingCount}</b>자리 남음</span>
      </div>
    </section>
  );
});

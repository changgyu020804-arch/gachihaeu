"use client";

import {
  RecentRating,
  RatingType,
  SPORT_META,
  UserProfile,
} from "@/lib/types/activity";

type ReputationPanelProps = {
  profile: UserProfile;
  recentRatings: RecentRating[];
  onHideComment?: (ratingId: string) => void;
};

const LABELS: Record<RatingType, [string, string, string]> = {
  host_to_member: ["시간 약속", "팀워크", "매너"],
  member_to_host: ["설명 정확도", "진행", "안전·배려"],
  legacy: ["신뢰", "실력", "인성"],
};

export function ReputationPanel({
  profile,
  recentRatings,
  onHideComment,
}: ReputationPanelProps) {
  const mannerVisible = profile.mannerRatingCount >= 3;

  return (
    <>
      <div className="reputation-card">
        {mannerVisible ? (
          <div className="reputation-overview">
            <div>
              <small>매너점수</small>
              <strong>{profile.mannerScore?.toFixed(1) ?? "-"}</strong>
            </div>
            <span>★</span>
            <p>모든 운동에서 받은 {profile.mannerRatingCount}개의 매너 평가</p>
          </div>
        ) : (
          <div className="reputation-newcomer">
            <span>🌱</span>
            <div>
              <strong>새로운 메이트</strong>
              <p>평가가 3개 이상 쌓이면 매너점수가 공개돼요.</p>
            </div>
            <small>{Math.min(profile.mannerRatingCount, 3)}/3</small>
          </div>
        )}

        <div className="sport-skill-section">
          <div className="sport-skill-heading">
            <strong>종목별 실력</strong>
            <span>종목마다 평가 3개부터 공개</span>
          </div>
          {profile.sportSkillScores.length > 0 ? (
            <div className="sport-skill-list">
              {profile.sportSkillScores.map((item) => {
                const visible = item.ratingCount >= 3;
                const meta = SPORT_META[item.sport];
                return (
                  <div className="sport-skill-item" key={item.sport}>
                    <span className="sport-skill-icon">{meta?.icon ?? "🏅"}</span>
                    <div>
                      <strong>{item.sport}</strong>
                      <small>{visible ? `${item.ratingCount}개의 평가` : `${item.ratingCount}/3 평가`}</small>
                    </div>
                    {visible && item.score != null ? (
                      <b><span>★</span>{item.score.toFixed(1)}</b>
                    ) : (
                      <em>평가 수집 중</em>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="sport-skill-empty">
              새 평가를 받으면 운동 종목별 실력이 여기에 표시돼요.
            </p>
          )}
        </div>
      </div>

      {recentRatings.length > 0 && (
        <div className="recent-ratings">
          <h3>받은 한줄 코멘트</h3>
          <p className="comments-privacy">작성자는 공개되지 않아요.</p>
          {recentRatings.map((rating) => {
            const labels = LABELS[rating.ratingType];
            const isSkillManner =
              rating.evaluationVersion === "skill_manner_v2";
            return (
              <article className="recent-rating-item" key={rating.id}>
                <div className="recent-rating-topline">
                  <span>
                    {rating.ratingType === "host_to_member"
                      ? "모임장 평가"
                      : rating.ratingType === "member_to_host"
                        ? "구성원 평가"
                        : "기존 평가"}
                  </span>
                  <time>{new Date(rating.createdAt).toLocaleDateString("ko-KR")}</time>
                </div>
                <p className="recent-rating-comment">“{rating.comment}”</p>
                <div className="recent-rating-scores">
                  {isSkillManner ? (
                    <>
                      <span>실력 <b>{rating.skillScore}</b></span>
                      <span>매너 <b>{rating.mannerScore}</b></span>
                    </>
                  ) : (
                    <>
                      <span>{labels[0]} <b>{rating.scoreOne}</b></span>
                      <span>{labels[1]} <b>{rating.scoreTwo}</b></span>
                      <span>{labels[2]} <b>{rating.scoreThree}</b></span>
                    </>
                  )}
                </div>
                <div className="recent-rating-footer">
                  <p>{rating.sport} · {rating.title}</p>
                  {onHideComment && (
                    <button onClick={() => onHideComment(rating.id)}>
                      숨기기·신고
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

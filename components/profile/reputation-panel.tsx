"use client";

import { RecentRating, RatingType, UserProfile } from "@/lib/types/activity";

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

function ScoreRow({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const rounded = Math.round(value);
  return (
    <div className="rating-score-item">
      <span className="rating-label">{label}</span>
      <div className="rating-stars" aria-label={`${value.toFixed(1)}점`}>
        {"★".repeat(rounded)}
        {"☆".repeat(5 - rounded)}
      </div>
      <span className="rating-value">{value.toFixed(1)}</span>
    </div>
  );
}

function RatingGroup({
  title,
  count,
  scores,
}: {
  title: string;
  count: number;
  scores: Array<[string, number | null]>;
}) {
  if (count === 0) return null;
  return (
    <div className="reputation-group">
      <div className="reputation-group-title">
        <strong>{title}</strong>
        <span>{count}개</span>
      </div>
      {scores.map(([label, value]) => (
        <ScoreRow key={label} label={label} value={value} />
      ))}
    </div>
  );
}

export function ReputationPanel({
  profile,
  recentRatings,
  onHideComment,
}: ReputationPanelProps) {
  const scoreVisible = profile.ratingCount >= 3;

  return (
    <>
      <div className="reputation-card">
        {scoreVisible ? (
          <div className="reputation-overview">
            <div>
              <small>같이점수</small>
              <strong>{profile.reputationScore?.toFixed(1) ?? "-"}</strong>
            </div>
            <span>★</span>
            <p>검증된 모임에서 받은 {profile.ratingCount}개의 평가</p>
          </div>
        ) : (
          <div className="reputation-newcomer">
            <span>🌱</span>
            <div>
              <strong>새로운 메이트</strong>
              <p>평가가 3개 이상 쌓이면 같이점수가 공개돼요.</p>
            </div>
            <small>{profile.ratingCount}/3</small>
          </div>
        )}

        {scoreVisible && (
          <div className="reputation-groups">
            <RatingGroup
              title="메이트로서"
              count={profile.memberRatingCount}
              scores={[
                ["시간 약속", profile.avgPunctuality],
                ["팀워크", profile.avgTeamwork],
                ["매너", profile.avgMemberManner],
              ]}
            />
            <RatingGroup
              title="모임장으로서"
              count={profile.hostRatingCount}
              scores={[
                ["설명 정확도", profile.avgAccuracy],
                ["진행", profile.avgFacilitation],
                ["안전·배려", profile.avgSafety],
              ]}
            />
          </div>
        )}
      </div>

      {recentRatings.length > 0 && (
        <div className="recent-ratings">
          <h3>받은 한줄 코멘트</h3>
          <p className="comments-privacy">작성자는 공개되지 않아요.</p>
          {recentRatings.map((rating) => {
            const labels = LABELS[rating.ratingType];
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
                  <span>{labels[0]} <b>{rating.scoreOne}</b></span>
                  <span>{labels[1]} <b>{rating.scoreTwo}</b></span>
                  <span>{labels[2]} <b>{rating.scoreThree}</b></span>
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

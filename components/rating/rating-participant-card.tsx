import { AttendanceStatus, ParticipantInfo } from "@/lib/types/activity";
import {
  ATTENDANCE_OPTIONS,
  EMPTY_SCORES,
  RatingContext,
  Scores,
} from "@/components/rating/rating-types";

type RatingParticipantCardProps = {
  participant: ParticipantInfo;
  context: RatingContext;
  scores: Scores | undefined;
  submitting: boolean;
  onViewProfile: (email: string) => void;
  onSetAttendance: (email: string, status: AttendanceStatus) => void;
  onScoresChange: (email: string, scores: Scores) => void;
  onSubmitRating: (email: string) => void;
};

export function RatingParticipantCard({
  participant,
  context,
  scores,
  submitting,
  onViewProfile,
  onSetAttendance,
  onScoresChange,
  onSubmitRating,
}: RatingParticipantCardProps) {
  const current = scores ?? EMPTY_SCORES;
  const memberCanRateHost =
    !context.isOwner && context.currentUserAttendance === "attended";
  const canRate =
    context.hasEnded &&
    (context.isOwner
      ? participant.attendanceStatus === "attended"
      : memberCanRateHost);
  const hasMannerScore =
    participant.mannerRatingCount >= 3 && participant.mannerScore != null;
  const hasSportSkillScore =
    participant.sportSkillRatingCount >= 3 &&
    participant.sportSkillScore != null;
  const categories = [
    {
      key: "skill" as const,
      label: "실력",
      description: "이 종목에서 보여준 운동 수행 수준",
    },
    {
      key: "manner" as const,
      label: "매너",
      description: "시간 약속·팀워크·배려와 안전 의식",
    },
  ];

  return (
    <div className="rate-participant">
      <div className="rate-participant-header">
        <button
          className="rate-participant-avatar"
          onClick={() => onViewProfile(participant.email)}
          aria-label={`${participant.nickname} 프로필 보기`}
        >
          {participant.nickname.slice(0, 1).toUpperCase()}
        </button>
        <button
          className="rate-participant-info"
          onClick={() => onViewProfile(participant.email)}
        >
          <strong>
            {participant.nickname}
            {participant.isHost && <em>모임장</em>}
          </strong>
          <small>{participant.department || "학과 미설정"}</small>
        </button>
        {participant.hasRated ? (
          <span className="rated-badge">평가 완료</span>
        ) : hasMannerScore || hasSportSkillScore ? (
          <div className="participant-score">
            {hasSportSkillScore && (
              <span>
                <small>실력</small>
                <span className="star-sm">★</span>
                {participant.sportSkillScore?.toFixed(1)}
              </span>
            )}
            {hasMannerScore && (
              <span>
                <small>매너</small>
                <span className="star-sm">★</span>
                {participant.mannerScore?.toFixed(1)}
              </span>
            )}
          </div>
        ) : (
          <span className="new-mate-badge">새 메이트</span>
        )}
      </div>

      {!context.hasEnded && (
        <p className="rating-status-message">모임이 끝난 뒤 역할에 맞게 평가할 수 있어요.</p>
      )}

      {context.hasEnded && context.isOwner && (
        <div className="attendance-control">
          <span>출석 확인</span>
          <div>
            {ATTENDANCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={
                  participant.attendanceStatus === option.value
                    ? `active ${option.value}`
                    : ""
                }
                disabled={submitting || participant.hasRated}
                onClick={() => onSetAttendance(participant.email, option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {context.hasEnded &&
        context.isOwner &&
        participant.attendanceStatus === "pending" && (
          <p className="rating-status-message">참석 여부를 선택하면 평가할 수 있어요.</p>
        )}
      {context.hasEnded &&
        context.isOwner &&
        participant.attendanceStatus !== "pending" &&
        participant.attendanceStatus !== "attended" && (
          <p className="rating-status-message">참석하지 않은 구성원은 평가 대상에서 제외돼요.</p>
        )}
      {context.hasEnded && !context.isOwner && !memberCanRateHost && (
        <p className="rating-status-message">모임장이 내 참석을 확인하면 평가할 수 있어요.</p>
      )}

      {canRate && !participant.hasRated && (
        <>
          {categories.map((category) => (
            <div className="rate-category" key={category.key}>
              <div className="rate-category-copy">
                <span className="rate-category-label">{category.label}</span>
                <small>{category.description}</small>
              </div>
              <div className="star-input">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    className={star <= current[category.key] ? "filled" : ""}
                    onClick={() =>
                      onScoresChange(participant.email, {
                        ...current,
                        [category.key]: star,
                      })
                    }
                    aria-label={`${category.label} ${star}점`}
                  >
                    {star <= current[category.key] ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="rate-comment">
            <input
              placeholder="익명 한줄 코멘트 (선택, 최대 100자)"
              maxLength={100}
              value={current.comment}
              onChange={(event) =>
                onScoresChange(participant.email, {
                  ...current,
                  comment: event.target.value,
                })
              }
            />
            <small>연락처와 외부 계정은 작성할 수 없어요.</small>
          </div>
          <div className="rate-submit-row">
            <button
              className="rate-submit-btn"
              disabled={
                submitting ||
                current.skill === 0 ||
                current.manner === 0
              }
              onClick={() => onSubmitRating(participant.email)}
            >
              평가 저장
            </button>
          </div>
        </>
      )}
    </div>
  );
}

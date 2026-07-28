"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AttendanceStatus, ParticipantInfo } from "../activity-data";
import { getErrorMessage } from "./utils";

type RatingSheetProps = {
  activityId: string;
  onClose: () => void;
  onToast: (msg: string) => void;
  onViewProfile: (email: string) => void;
};

type RatingContext = {
  isOwner: boolean;
  hasEnded: boolean;
  activityStatus: string;
  creatorEmail: string;
  currentUserAttendance: AttendanceStatus;
};

type Scores = {
  one: number;
  two: number;
  three: number;
  comment: string;
};

const EMPTY_SCORES: Scores = { one: 0, two: 0, three: 0, comment: "" };

const ATTENDANCE_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
}> = [
  { value: "attended", label: "참석" },
  { value: "absent", label: "불참" },
  { value: "no_show", label: "노쇼" },
];

export function RatingSheet({
  activityId,
  onClose,
  onToast,
  onViewProfile,
}: RatingSheetProps) {
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [context, setContext] = useState<RatingContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scores, setScores] = useState<Record<string, Scores>>({});

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/activities/${activityId}/participants`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        participants?: ParticipantInfo[];
        context?: RatingContext;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "참여자를 불러오지 못했어요.");
      }
      setParticipants(payload.participants ?? []);
      setContext(payload.context ?? null);
    } catch (error) {
      setParticipants([]);
      setContext(null);
      onToast(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activityId, onToast]);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const visibleParticipants = useMemo(() => {
    if (!context?.hasEnded) return participants;
    return context.isOwner
      ? participants.filter((participant) => !participant.isHost)
      : participants.filter((participant) => participant.isHost);
  }, [context, participants]);

  const setAttendance = async (
    participantEmail: string,
    attendanceStatus: AttendanceStatus,
  ) => {
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/activities/${activityId}/participants`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantEmail, attendanceStatus }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "출석 상태를 저장하지 못했어요.");
      }
      setParticipants((current) =>
        current.map((participant) =>
          participant.email === participantEmail
            ? { ...participant, attendanceStatus }
            : participant,
        ),
      );
      onToast("출석 상태를 저장했어요.");
    } catch (error) {
      onToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitRating = async (ratedEmail: string) => {
    const current = scores[ratedEmail];
    if (
      !current ||
      current.one === 0 ||
      current.two === 0 ||
      current.three === 0
    ) {
      onToast("모든 항목에 별점을 매겨 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId,
          ratedEmail,
          scoreOne: current.one,
          scoreTwo: current.two,
          scoreThree: current.three,
          comment: current.comment,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "평가를 저장하지 못했어요.");
      }
      onToast("평가가 저장됐어요!");
      setParticipants((previous) =>
        previous.map((participant) =>
          participant.email === ratedEmail
            ? { ...participant, hasRated: true }
            : participant,
        ),
      );
    } catch (error) {
      onToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const title = !context?.hasEnded
    ? "함께할 구성원"
    : context.isOwner
      ? "출석 확인 및 구성원 평가"
      : "모임장 평가";
  const categoryLabels = context?.isOwner
    ? ["시간 약속", "팀워크", "매너"]
    : ["설명 정확도", "진행", "안전·배려"];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet rate-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="section-kicker">
              {context?.hasEnded ? "VERIFIED REVIEW" : "TEAMMATES"}
            </p>
            <h2 id="rate-title">{title}</h2>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {context?.hasEnded && context.isOwner && (
          <div className="rating-guide">
            실제 참석 여부를 먼저 확인해 주세요. 참석한 구성원만 평가할 수 있어요.
          </div>
        )}
        {context?.hasEnded && !context.isOwner && (
          <div className="rating-guide">
            구성원은 모임장만 평가할 수 있으며 작성자는 프로필에 공개되지 않아요.
          </div>
        )}

        {loading ? (
          <div className="profile-loading">참여자 불러오는 중...</div>
        ) : visibleParticipants.length === 0 ? (
          <div className="profile-loading">
            {context?.isOwner ? "확인할 구성원이 없어요." : "모임장 정보를 찾지 못했어요."}
          </div>
        ) : (
          visibleParticipants.map((participant) => {
            const current = scores[participant.email] ?? EMPTY_SCORES;
            const memberCanRateHost =
              !context?.isOwner &&
              context?.currentUserAttendance === "attended";
            const canRate =
              Boolean(context?.hasEnded) &&
              (context?.isOwner
                ? participant.attendanceStatus === "attended"
                : memberCanRateHost);

            return (
              <div className="rate-participant" key={participant.email}>
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
                  ) : participant.ratingCount >= 3 ? (
                    <div className="participant-score">
                      <span>
                        <span className="star-sm">★</span>
                        {participant.reputationScore?.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span className="new-mate-badge">새 메이트</span>
                  )}
                </div>

                {!context?.hasEnded && (
                  <p className="rating-status-message">
                    모임이 끝난 뒤 역할에 맞게 평가할 수 있어요.
                  </p>
                )}

                {context?.hasEnded && context.isOwner && (
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
                          onClick={() =>
                            void setAttendance(participant.email, option.value)
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {context?.hasEnded &&
                  context.isOwner &&
                  participant.attendanceStatus === "pending" && (
                    <p className="rating-status-message">
                      참석 여부를 선택하면 평가할 수 있어요.
                    </p>
                  )}
                {context?.hasEnded &&
                  context.isOwner &&
                  participant.attendanceStatus !== "pending" &&
                  participant.attendanceStatus !== "attended" && (
                    <p className="rating-status-message">
                      참석하지 않은 구성원은 평가 대상에서 제외돼요.
                    </p>
                  )}
                {context?.hasEnded &&
                  !context.isOwner &&
                  !memberCanRateHost && (
                    <p className="rating-status-message">
                      모임장이 내 참석을 확인하면 평가할 수 있어요.
                    </p>
                  )}

                {canRate && !participant.hasRated && (
                  <>
                    {(["one", "two", "three"] as const).map((category, index) => (
                      <div className="rate-category" key={category}>
                        <span className="rate-category-label">
                          {categoryLabels[index]}
                        </span>
                        <div className="star-input">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              className={star <= current[category] ? "filled" : ""}
                              onClick={() =>
                                setScores((previous) => ({
                                  ...previous,
                                  [participant.email]: {
                                    ...current,
                                    [category]: star,
                                  },
                                }))
                              }
                              aria-label={`${categoryLabels[index]} ${star}점`}
                            >
                              {star <= current[category] ? "★" : "☆"}
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
                          setScores((previous) => ({
                            ...previous,
                            [participant.email]: {
                              ...current,
                              comment: event.target.value,
                            },
                          }))
                        }
                      />
                      <small>연락처와 외부 계정은 작성할 수 없어요.</small>
                    </div>
                    <div className="rate-submit-row">
                      <button
                        className="rate-submit-btn"
                        disabled={
                          submitting ||
                          current.one === 0 ||
                          current.two === 0 ||
                          current.three === 0
                        }
                        onClick={() => void submitRating(participant.email)}
                      >
                        평가 저장
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

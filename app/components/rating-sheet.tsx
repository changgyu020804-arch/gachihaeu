"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AttendanceStatus, ParticipantInfo } from "../activity-data";
import { getErrorMessage } from "./utils";
import { RatingParticipantCard } from "./rating-participant-card";
import { RatingContext, Scores } from "./rating-types";

type RatingSheetProps = {
  activityId: string;
  onClose: () => void;
  onToast: (msg: string) => void;
  onViewProfile: (email: string) => void;
};

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
    const initialLoadTimer = window.setTimeout(() => {
      void loadParticipants();
    }, 0);
    return () => window.clearTimeout(initialLoadTimer);
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
        ) : !context ? (
          <div className="profile-loading">모임 정보를 불러오지 못했어요.</div>
        ) : visibleParticipants.length === 0 ? (
          <div className="profile-loading">
            {context.isOwner ? "확인할 구성원이 없어요." : "모임장 정보를 찾지 못했어요."}
          </div>
        ) : (
          visibleParticipants.map((participant) => (
            <RatingParticipantCard
              key={participant.email}
              participant={participant}
              context={context}
              scores={scores[participant.email]}
              submitting={submitting}
              categoryLabels={categoryLabels}
              onViewProfile={onViewProfile}
              onSetAttendance={(email, status) => void setAttendance(email, status)}
              onScoresChange={(email, nextScores) =>
                setScores((previous) => ({ ...previous, [email]: nextScores }))
              }
              onSubmitRating={(email) => void submitRating(email)}
            />
          ))
        )}
      </section>
    </div>
  );
}

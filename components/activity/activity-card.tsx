"use client";

import { memo } from "react";
import { Activity, SPORT_META } from "@/lib/types/activity";
import { formatTime, formatShortDate } from "@/lib/utils/ui";

type ActivityCardProps = {
  activity: Activity;
  renderedAt: number;
  submitting: boolean;
  onSelect: (activity: Activity) => void;
  onPerformAction: (path: string, method: "POST" | "DELETE", msg: string) => void;
  onOpenRating: (activityId: string) => void;
};

export const ActivityCard = memo(function ActivityCard({
  activity,
  renderedAt,
  submitting,
  onSelect,
  onPerformAction,
  onOpenRating,
}: ActivityCardProps) {
  const meta = SPORT_META[activity.sport];
  const left = activity.capacity - activity.participantCount;
  const hasEnded =
    new Date(activity.startsAt).getTime() +
      activity.durationMinutes * 60_000 <
    renderedAt;
  const cancellationClosed =
    renderedAt >=
    new Date(activity.startsAt).getTime() -
      activity.cancellationDeadlineMinutes * 60_000;

  const handleButtonClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    if (activity.isOwner && hasEnded) {
      onOpenRating(activity.id);
      return;
    }

    if (activity.isOwner) {
      onSelect(activity);
      return;
    }

    if (activity.isJoined && hasEnded) {
      onOpenRating(activity.id);
      return;
    }

    if (activity.isJoined && cancellationClosed) {
      onSelect(activity);
      return;
    }

    if (activity.isWaitlisted) {
      onPerformAction(`/api/activities/${activity.id}/waitlist`, "DELETE", "대기를 취소했어요.");
      return;
    }

    if (left === 0 && !activity.isJoined) {
      onPerformAction(`/api/activities/${activity.id}/waitlist`, "POST", "대기 등록됐어요! 자리가 나면 자동 참여돼요.");
      return;
    }

    onPerformAction(
      `/api/activities/${activity.id}/join`,
      activity.isJoined ? "DELETE" : "POST",
      activity.isJoined ? "참가를 취소했어요." : "참가가 완료됐어요!",
    );
  };

  const getButtonLabel = () => {
    if (activity.isOwner && hasEnded) return "출석·평가";
    if (activity.isJoined && hasEnded) return "모임장 평가";
    if (activity.isOwner) return "관리하기";
    if (activity.isJoined) return cancellationClosed ? "취소 마감" : "참가 완료";
    if (activity.isWaitlisted) return `대기 ${activity.waitlistPosition}번째`;
    if (left === 0) return "대기하기";
    return "같이하기";
  };

  return (
    <article className="match-card" onClick={() => onSelect(activity)}>
      <div className="match-topline">
        <div className="match-topline-left">
          <span className="sport-label" style={{ color: meta.color, background: meta.softColor }}>
            {meta.icon} {activity.sport}
          </span>
          {activity.facilityReserved && <span className="reserved-label">시설예약 ✓</span>}
        </div>
        <div className="match-topline-center">
          {hasEnded && <span className="completed-label">종료</span>}
        </div>
        <div className="match-topline-right">
          {activity.isOwner && <span className="owner-label">내가 만든 모임</span>}
        </div>
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
              {left === 0
                ? activity.waitlistCount > 0
                  ? `${activity.waitlistCount}명 대기 중`
                  : "모집 완료"
                : `${left}자리 남음`}
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
          className={`join-button ${activity.isJoined ? "joined" : ""} ${activity.isWaitlisted ? "waitlisted" : ""}`}
          onClick={handleButtonClick}
          disabled={submitting}
        >
          {getButtonLabel()}
        </button>
      </div>
    </article>
  );
});

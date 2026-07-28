"use client";

import { Activity, SPORT_META, isReservationRequired } from "../activity-data";
import { formatFullDate } from "./utils";

type DetailSheetProps = {
  activity: Activity;
  submitting: boolean;
  onClose: () => void;
  onPerformAction: (path: string, method: "POST" | "DELETE", msg: string, body?: unknown) => void;
  onOpenRating: (activityId: string) => void;
  onReport: (activity: Activity) => void;
};

export function DetailSheet({
  activity,
  submitting,
  onClose,
  onPerformAction,
  onOpenRating,
  onReport,
}: DetailSheetProps) {
  const isFull = activity.participantCount >= activity.capacity;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span
            className="detail-sport-icon"
            style={{ background: SPORT_META[activity.sport].softColor }}
          >
            {SPORT_META[activity.sport].icon}
          </span>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <span className="detail-label">{activity.sport} · {activity.level}</span>
        {activity.facilityReserved && (
          <span className="detail-reserved-badge">시설예약 완료 ✓</span>
        )}
        {isReservationRequired(activity.venue) && !activity.facilityReserved && (
          <span className="detail-no-reserve-badge">시설예약 미확인</span>
        )}
        <h2 id="detail-title">{activity.title}</h2>
        <div className="detail-info">
          <p><span>날짜</span><strong>{formatFullDate(activity.startsAt)}</strong></p>
          <p><span>장소</span><strong>{activity.venue}</strong></p>
          <p><span>시간</span><strong>{activity.durationMinutes}분</strong></p>
          <p><span>인원</span><strong>{activity.participantCount}/{activity.capacity}명</strong></p>
        </div>
        {activity.description && (
          <div className="detail-description">{activity.description}</div>
        )}
        <div className="detail-host">
          <span>{activity.creatorName.slice(0, 1)}</span>
          <div><small>모임장</small><strong>{activity.creatorName}</strong></div>
        </div>

        {activity.isJoined && (
          <div className="participant-section">
            <h3>참여자 ({activity.participantCount}명)</h3>
            <button
              className="edit-profile-button"
              style={{ marginTop: 0, marginBottom: 12 }}
              onClick={() => onOpenRating(activity.id)}
            >
              {new Date(activity.startsAt).getTime() + activity.durationMinutes * 60_000 < Date.now()
                ? activity.isOwner
                  ? "출석 확인 및 구성원 평가 ★"
                  : "모임장 평가하기 ★"
                : "참여자 보기"}
            </button>
          </div>
        )}

        {activity.isOwner ? (
          <button
            className="danger-button"
            disabled={submitting}
            onClick={() => {
              if (!window.confirm("모임을 취소할까요? 참가자 목록에서도 사라집니다.")) return;
              onPerformAction(`/api/activities/${activity.id}`, "DELETE", "모임을 취소했어요.");
            }}
          >
            모임 취소하기
          </button>
        ) : (
          <div className="detail-actions">
            <button className="report-button" onClick={() => onReport(activity)}>
              신고
            </button>
            {activity.isWaitlisted ? (
              <button
                className="primary-button soft"
                disabled={submitting}
                onClick={() => onPerformAction(`/api/activities/${activity.id}/waitlist`, "DELETE", "대기를 취소했어요.")}
              >
                대기 취소 ({activity.waitlistPosition}번째)
              </button>
            ) : isFull && !activity.isJoined ? (
              <button
                className="primary-button"
                disabled={submitting}
                onClick={() => onPerformAction(`/api/activities/${activity.id}/waitlist`, "POST", "대기 등록됐어요! 자리가 나면 자동 참여돼요.")}
              >
                대기하기 ({activity.waitlistCount}명 대기 중)
              </button>
            ) : (
              <button
                className={`primary-button ${activity.isJoined ? "soft" : ""}`}
                disabled={submitting}
                onClick={() => onPerformAction(
                  `/api/activities/${activity.id}/join`,
                  activity.isJoined ? "DELETE" : "POST",
                  activity.isJoined ? "참가를 취소했어요." : "참가가 완료됐어요!",
                )}
              >
                {activity.isJoined ? "참가 취소" : "같이하기"}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

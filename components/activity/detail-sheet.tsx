"use client";

import { useState } from "react";
import { Activity, SPORT_META, isReservationRequired } from "@/lib/types/activity";
import { formatFullDate } from "@/lib/utils/ui";
import { ActivityComments } from "@/components/activity/activity-comments";
import { AttendanceCheckIn } from "@/components/activity/attendance-check-in";

type DetailSheetProps = {
  activity: Activity;
  submitting: boolean;
  onClose: () => void;
  onPerformAction: (
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    msg: string,
    body?: unknown,
  ) => void;
  onOpenRating: (activityId: string) => void;
  onReport: (activity: Activity) => void;
  onViewProfile: (email: string) => void;
  onToast: (message: string) => void;
};

export function DetailSheet({
  activity,
  submitting,
  onClose,
  onPerformAction,
  onOpenRating,
  onReport,
  onViewProfile,
  onToast,
}: DetailSheetProps) {
  const isFull = activity.participantCount >= activity.capacity;
  const [renderedAt] = useState(() => Date.now());
  const [editingNotice, setEditingNotice] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState(activity.notice);
  const startsAt = new Date(activity.startsAt).getTime();
  const hasEnded =
    startsAt + activity.durationMinutes * 60_000 < renderedAt;
  const cancellationLabel =
    activity.cancellationDeadlineMinutes === 0
      ? "모임 시작 직전까지"
      : activity.cancellationDeadlineMinutes === 1440
        ? "시작 하루 전까지"
        : `시작 ${activity.cancellationDeadlineMinutes / 60}시간 전까지`;
  const cancellationClosed =
    renderedAt >=
    startsAt -
      activity.cancellationDeadlineMinutes * 60_000;

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
        {activity.notice && (
          <div className="activity-notice">
            <span>공지</span>
            <p>{activity.notice}</p>
          </div>
        )}
        {activity.isOwner && (
          <div className="notice-editor">
            {editingNotice ? (
              <>
                <textarea
                  maxLength={300}
                  value={noticeDraft}
                  placeholder="준비물이나 변경 사항을 알려주세요."
                  onChange={(event) => setNoticeDraft(event.target.value)}
                />
                <div>
                  <button type="button" onClick={() => setEditingNotice(false)}>
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={submitting || noticeDraft.trim().length === 0}
                    onClick={() =>
                      onPerformAction(
                        `/api/activities/${activity.id}`,
                        "PATCH",
                        "참가자에게 공지를 보냈어요.",
                        { notice: noticeDraft },
                      )
                    }
                  >
                    공지 보내기
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setEditingNotice(true)}>
                {activity.notice ? "공지 수정하기" : "참가자에게 공지하기"}
              </button>
            )}
          </div>
        )}
        <p className="cancellation-policy">
          참가 취소 가능 시간 · <strong>{cancellationLabel}</strong>
        </p>
        <div className="detail-host">
          <span>{activity.creatorName.slice(0, 1)}</span>
          <div><small>모임장</small><strong>{activity.creatorName}</strong></div>
        </div>

        {activity.isJoined && (
          <div className="participant-section">
            <AttendanceCheckIn
              activityId={activity.id}
              isOwner={activity.isOwner}
              onToast={onToast}
            />
            <h3>참여자 ({activity.participantCount}명)</h3>
            <button
              className="edit-profile-button"
              style={{ marginTop: 0, marginBottom: 12 }}
              onClick={() => onOpenRating(activity.id)}
            >
              {hasEnded
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
              const reason = window.prompt(
                "참가자에게 전달할 취소 사유를 입력해 주세요.",
              );
              if (reason === null) return;
              if (reason.trim().length < 2) {
                window.alert("취소 사유를 두 글자 이상 입력해 주세요.");
                return;
              }
              onPerformAction(
                `/api/activities/${activity.id}`,
                "DELETE",
                "취소 사유를 참가자에게 알렸어요.",
                { cancellationReason: reason },
              );
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
                disabled={submitting || (activity.isJoined && cancellationClosed)}
                onClick={() => onPerformAction(
                  `/api/activities/${activity.id}/join`,
                  activity.isJoined ? "DELETE" : "POST",
                  activity.isJoined ? "참가를 취소했어요." : "참가가 완료됐어요!",
                )}
              >
                {activity.isJoined
                  ? cancellationClosed
                    ? "참가 취소 마감"
                    : "참가 취소"
                  : "같이하기"}
              </button>
            )}
          </div>
        )}

        <ActivityComments
          key={activity.id}
          activityId={activity.id}
          onViewProfile={onViewProfile}
        />
      </section>
    </div>
  );
}

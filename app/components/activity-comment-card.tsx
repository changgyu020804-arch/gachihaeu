"use client";

import { ActivityComment } from "../activity-comments";

type ActivityCommentCardProps = {
  comment: ActivityComment;
  submitting: boolean;
  onViewProfile: (email: string) => void;
  onPin: (comment: ActivityComment) => void;
  onRemove: (comment: ActivityComment) => void;
  onReport: (comment: ActivityComment) => void;
};

function formatCommentTime(value: string) {
  const normalized = value.endsWith("Z")
    ? value
    : `${value.replace(" ", "T")}Z`;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(normalized));
}

export function ActivityCommentCard({
  comment,
  submitting,
  onViewProfile,
  onPin,
  onRemove,
  onReport,
}: ActivityCommentCardProps) {
  return (
    <article className={`comment-card ${comment.isPinned ? "pinned" : ""}`}>
      {comment.isPinned && <span className="pinned-label">📌 모임장 고정</span>}
      <header>
        <button
          type="button"
          className="comment-avatar"
          disabled={comment.isMine}
          onClick={() => onViewProfile(comment.authorEmail)}
          aria-label={`${comment.authorName} 프로필 보기`}
        >
          {comment.authorName.slice(0, 1).toUpperCase()}
        </button>
        <div>
          <strong>{comment.authorName}</strong>
          {comment.isOwner ? (
            <span className="comment-role owner">모임장</span>
          ) : comment.isParticipant ? (
            <span className="comment-role">참가자</span>
          ) : null}
          {comment.campusRole && <small>{comment.campusRole}</small>}
        </div>
        <time>{formatCommentTime(comment.createdAt)}</time>
      </header>
      <p>{comment.content}</p>
      <footer>
        {comment.canPin && (
          <button type="button" disabled={submitting} onClick={() => onPin(comment)}>
            {comment.isPinned ? "고정 해제" : "상단 고정"}
          </button>
        )}
        {(comment.canDelete || comment.canHide) && (
          <button type="button" disabled={submitting} onClick={() => onRemove(comment)}>
            {comment.canDelete ? "삭제" : "숨기기"}
          </button>
        )}
        {comment.canReport && (
          <button type="button" disabled={submitting} onClick={() => onReport(comment)}>
            신고
          </button>
        )}
      </footer>
    </article>
  );
}

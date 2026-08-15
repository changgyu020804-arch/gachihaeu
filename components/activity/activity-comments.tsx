"use client";

import {
  COMMENT_MAX_LENGTH,
  COMMENT_RENDER_LIMIT,
} from "@/lib/types/activity-comment";
import { ActivityCommentCard } from "@/components/activity/activity-comment-card";
import { useActivityComments } from "@/hooks/use-activity-comments";

type ActivityCommentsProps = {
  activityId: string;
  onViewProfile: (email: string) => void;
};

export function ActivityComments({
  activityId,
  onViewProfile,
}: ActivityCommentsProps) {
  const {
    comments,
    draft,
    setDraft,
    total,
    nextOffset,
    locked,
    loading,
    submitting,
    error,
    message,
    submitComment,
    loadMore,
    pinComment,
    removeComment,
    reportComment,
  } = useActivityComments(activityId);

  return (
    <section className="activity-comments" aria-labelledby="comments-title">
      <div className="comments-heading">
        <div>
          <span>ACTIVITY COMMENTS</span>
          <h3 id="comments-title">모임 댓글 <b>{total}</b></h3>
        </div>
        <small>최근 댓글부터 20개씩 보여줘요</small>
      </div>

      {!locked && (
        <form className="comment-composer" onSubmit={submitComment}>
          <textarea
            required
            maxLength={COMMENT_MAX_LENGTH}
            value={draft}
            placeholder="궁금한 점이나 모임 이야기를 남겨보세요."
            onChange={(event) => setDraft(event.target.value)}
            disabled={submitting}
          />
          <div>
            <small>{draft.length}/{COMMENT_MAX_LENGTH}</small>
            <button disabled={submitting || draft.trim().length === 0}>
              댓글 등록
            </button>
          </div>
        </form>
      )}

      {locked && (
        <p className="comments-locked">
          모임 종료 후 24시간이 지나 댓글 작성이 종료됐어요.
        </p>
      )}
      {error && <p className="comments-error" role="alert">{error}</p>}
      {message && <p className="comments-success" role="status">{message}</p>}

      <div className="comment-list">
        {loading ? (
          <p className="comments-empty">댓글을 불러오고 있어요.</p>
        ) : comments.length === 0 ? (
          <p className="comments-empty">첫 번째 댓글을 남겨보세요.</p>
        ) : (
          comments.map((comment) => (
            <ActivityCommentCard
              key={comment.id}
              comment={comment}
              submitting={submitting}
              onViewProfile={onViewProfile}
              onPin={pinComment}
              onRemove={removeComment}
              onReport={reportComment}
            />
          ))
        )}
      </div>

      {nextOffset != null && comments.length < COMMENT_RENDER_LIMIT && (
        <button
          type="button"
          className="comments-more"
          disabled={submitting}
          onClick={() => void loadMore()}
        >
          이전 댓글 더 보기
        </button>
      )}
      {comments.length >= COMMENT_RENDER_LIMIT && nextOffset != null && (
        <p className="comments-limit">메모리를 아끼기 위해 최근 댓글 100개까지만 표시해요.</p>
      )}
    </section>
  );
}

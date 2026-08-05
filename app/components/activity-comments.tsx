"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ActivityComment,
  COMMENT_MAX_LENGTH,
  COMMENT_RENDER_LIMIT,
} from "../activity-comments";
import { ActivityCommentCard } from "./activity-comment-card";
import { getErrorMessage } from "./utils";

type CommentsPayload = {
  comments?: ActivityComment[];
  total?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
  locked?: boolean;
  error?: string;
};

type ActivityCommentsProps = {
  activityId: string;
  onViewProfile: (email: string) => void;
};

export function ActivityComments({
  activityId,
  onViewProfile,
}: ActivityCommentsProps) {
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [draft, setDraft] = useState("");
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadComments = useCallback(
    async (offset = 0, append = false, signal?: AbortSignal) => {
      const response = await fetch(
        `/api/activities/${activityId}/comments?offset=${offset}`,
        { cache: "no-store", signal },
      );
      const payload = (await response.json()) as CommentsPayload;
      if (!response.ok) {
        throw new Error(payload.error || "댓글을 불러오지 못했어요.");
      }

      const incoming = payload.comments ?? [];
      setComments((current) =>
        append
          ? [
              ...current,
              ...incoming.filter(
                (comment) =>
                  !current.some((existing) => existing.id === comment.id),
              ),
            ].slice(0, COMMENT_RENDER_LIMIT)
          : incoming,
      );
      setTotal(payload.total ?? incoming.length);
      setNextOffset(payload.hasMore ? (payload.nextOffset ?? null) : null);
      setLocked(Boolean(payload.locked));
    },
    [activityId],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadComments(0, false, controller.signal)
        .catch((loadError) => {
          if (
            active &&
            !(loadError instanceof DOMException && loadError.name === "AbortError")
          ) {
            setError(getErrorMessage(loadError));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadComments]);

  async function mutate(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
    successMessage = "",
  ) {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "댓글을 처리하지 못했어요.");
      }
      await loadComments();
      setMessage(successMessage);
      return true;
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    const created = await mutate(
      `/api/activities/${activityId}/comments`,
      "POST",
      { content: draft },
      "댓글이 등록됐어요.",
    );
    if (created) setDraft("");
  }

  async function loadMore() {
    if (nextOffset == null || comments.length >= COMMENT_RENDER_LIMIT) return;
    setSubmitting(true);
    setError("");
    try {
      await loadComments(nextOffset, true);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setSubmitting(false);
    }
  }

  function pinComment(comment: ActivityComment) {
    void mutate(
      `/api/activities/${activityId}/comments/${comment.id}`,
      "PATCH",
      { pinned: !comment.isPinned },
      comment.isPinned
        ? "댓글 고정을 해제했어요."
        : "중요 댓글로 고정했어요.",
    );
  }

  function removeComment(comment: ActivityComment) {
    const label = comment.canDelete ? "삭제" : "숨김";
    if (!window.confirm(`이 댓글을 ${label}할까요?`)) return;
    void mutate(
      `/api/activities/${activityId}/comments/${comment.id}`,
      "DELETE",
      undefined,
      comment.canDelete ? "댓글을 삭제했어요." : "댓글을 숨겼어요.",
    );
  }

  function reportComment(comment: ActivityComment) {
    const reason = window.prompt(
      "신고 이유를 입력해 주세요.",
      "부적절한 표현",
    );
    if (reason === null) return;
    void mutate(
      `/api/activities/${activityId}/comments/${comment.id}/report`,
      "POST",
      { reason },
      "신고가 접수됐어요.",
    );
  }

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

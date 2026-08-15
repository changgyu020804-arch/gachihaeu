"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ActivityComment,
  COMMENT_RENDER_LIMIT,
} from "@/lib/types/activity-comment";
import { getErrorMessage } from "@/lib/utils/ui";

type CommentsPayload = {
  comments?: ActivityComment[];
  total?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
  locked?: boolean;
  error?: string;
};

export function useActivityComments(activityId: string) {
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

  const mutate = async (
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
    successMessage = "",
  ) => {
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
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const created = await mutate(
      `/api/activities/${activityId}/comments`,
      "POST",
      { content: draft },
      "댓글이 등록됐어요.",
    );
    if (created) setDraft("");
  };

  const loadMore = async () => {
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
  };

  const pinComment = (comment: ActivityComment) => {
    void mutate(
      `/api/activities/${activityId}/comments/${comment.id}`,
      "PATCH",
      { pinned: !comment.isPinned },
      comment.isPinned ? "댓글 고정을 해제했어요." : "중요 댓글로 고정했어요.",
    );
  };

  const removeComment = (comment: ActivityComment) => {
    const label = comment.canDelete ? "삭제" : "숨김";
    if (!window.confirm(`이 댓글을 ${label}할까요?`)) return;
    void mutate(
      `/api/activities/${activityId}/comments/${comment.id}`,
      "DELETE",
      undefined,
      comment.canDelete ? "댓글을 삭제했어요." : "댓글을 숨겼어요.",
    );
  };

  const reportComment = (comment: ActivityComment) => {
    const reason = window.prompt("신고 이유를 입력해 주세요.", "부적절한 표현");
    if (reason === null) return;
    void mutate(
      `/api/activities/${activityId}/comments/${comment.id}/report`,
      "POST",
      { reason },
      "신고가 접수됐어요.",
    );
  };

  return {
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
  };
}

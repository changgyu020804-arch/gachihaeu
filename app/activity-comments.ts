export const COMMENT_MAX_LENGTH = 300;
export const COMMENT_PAGE_SIZE = 20;
export const COMMENT_RENDER_LIMIT = 100;
export const COMMENT_WRITE_GRACE_MS = 24 * 60 * 60_000;

export type ActivityComment = {
  id: string;
  authorEmail: string;
  authorName: string;
  campusRole: string;
  content: string;
  createdAt: string;
  isPinned: boolean;
  isOwner: boolean;
  isParticipant: boolean;
  isMine: boolean;
  canDelete: boolean;
  canHide: boolean;
  canPin: boolean;
  canReport: boolean;
};

export type CommentActivityRow = {
  creator_email: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
};

export function isCommentingClosed(activity: CommentActivityRow) {
  const endsAt =
    new Date(activity.starts_at).getTime() +
    activity.duration_minutes * 60_000;
  return !Number.isFinite(endsAt) || Date.now() > endsAt + COMMENT_WRITE_GRACE_MS;
}

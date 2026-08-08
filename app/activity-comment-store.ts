import {
  ActivityComment,
  COMMENT_PAGE_SIZE,
  CommentActivityRow,
  isCommentingClosed,
} from "./activity-comments";

type CommentRow = {
  id: string;
  author_email: string;
  author_name: string;
  campus_role: string;
  content: string;
  created_at: string;
  is_pinned: number;
  is_participant: number;
};

export async function getCommentActivity(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT creator_email, title, starts_at, duration_minutes
       FROM activities
       WHERE id = ?`,
    )
    .bind(id)
    .first<CommentActivityRow>();
}

export async function listActivityComments(
  db: D1Database,
  activity: CommentActivityRow,
  activityId: string,
  viewerEmail: string,
  offset: number,
) {
  const [rows, count] = await Promise.all([
    db
      .prepare(
        `SELECT
           c.id,
           c.author_email,
           COALESCE(NULLIF(up.nickname, ''), substr(c.author_email, 1, instr(c.author_email, '@') - 1)) AS author_name,
           COALESCE(up.campus_role, '') AS campus_role,
           c.content,
           c.created_at,
           c.is_pinned,
           CASE WHEN EXISTS (
             SELECT 1 FROM participants p
             WHERE p.activity_id = c.activity_id AND p.user_email = c.author_email
           ) THEN 1 ELSE 0 END AS is_participant
         FROM activity_comments c
         LEFT JOIN user_profiles up ON up.email = c.author_email
         WHERE c.activity_id = ?
           AND c.status = 'visible'
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE
               (ub.blocker_email = ? AND ub.blocked_email = c.author_email)
               OR
               (ub.blocker_email = c.author_email AND ub.blocked_email = ?)
           )
         ORDER BY c.is_pinned DESC, datetime(c.created_at) DESC, c.id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(
        activityId,
        viewerEmail,
        viewerEmail,
        COMMENT_PAGE_SIZE + 1,
        offset,
      )
      .all<CommentRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM activity_comments c
         WHERE c.activity_id = ?
           AND c.status = 'visible'
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE
               (ub.blocker_email = ? AND ub.blocked_email = c.author_email)
               OR
               (ub.blocker_email = c.author_email AND ub.blocked_email = ?)
           )`,
      )
      .bind(activityId, viewerEmail, viewerEmail)
      .first<{ total: number }>(),
  ]);

  const hasMore = rows.results.length > COMMENT_PAGE_SIZE;
  const viewerIsOwner = activity.creator_email === viewerEmail;
  const comments: ActivityComment[] = rows.results
    .slice(0, COMMENT_PAGE_SIZE)
    .map((row) => {
      const isMine = row.author_email === viewerEmail;
      return {
        id: row.id,
        authorEmail: row.author_email,
        authorName: row.author_name,
        campusRole: row.campus_role,
        content: row.content,
        createdAt: row.created_at,
        isPinned: Boolean(row.is_pinned),
        isOwner: row.author_email === activity.creator_email,
        isParticipant: Boolean(row.is_participant),
        isMine,
        canDelete: isMine,
        canHide: viewerIsOwner && !isMine,
        canPin: viewerIsOwner,
        canReport: !isMine,
      };
    });

  return {
    comments,
    total: Number(count?.total ?? 0),
    hasMore,
    nextOffset: hasMore ? offset + COMMENT_PAGE_SIZE : null,
    locked: isCommentingClosed(activity),
  };
}

export async function getOwnerCommentRecipientEmails(
  db: D1Database,
  activityId: string,
  ownerEmail: string,
) {
  const recipients = await db
    .prepare(
      `SELECT recipient_email
       FROM (
         SELECT user_email AS recipient_email
         FROM participants
         WHERE activity_id = ? AND user_email <> ?
         UNION
         SELECT author_email AS recipient_email
         FROM activity_comments
         WHERE activity_id = ? AND author_email <> ? AND status = 'visible'
       ) recipients
       WHERE NOT EXISTS (
         SELECT 1 FROM user_blocks ub
         WHERE
           (ub.blocker_email = ? AND ub.blocked_email = recipients.recipient_email)
           OR
           (ub.blocker_email = recipients.recipient_email AND ub.blocked_email = ?)
       )`,
    )
    .bind(activityId, ownerEmail, activityId, ownerEmail, ownerEmail, ownerEmail)
    .all<{ recipient_email: string }>();

  return recipients.results.map((recipient) => recipient.recipient_email);
}

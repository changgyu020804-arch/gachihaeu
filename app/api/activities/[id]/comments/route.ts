import { getSessionUser } from "../../../../auth";
import {
  ActivityComment,
  COMMENT_MAX_LENGTH,
  COMMENT_PAGE_SIZE,
  CommentActivityRow,
  isCommentingClosed,
} from "../../../../activity-comments";
import { hasBlockedRelationship } from "../../../../activity-policy";
import {
  cleanUserText,
  hasUnsafeUserText,
} from "../../../../content-moderation";
import { createNotifications } from "../../../../notification-store";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  requestErrorResponse,
} from "../../../../security";
import { ensureSchema, getD1 } from "../../../../../db";

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

async function getActivity(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT creator_email, title, starts_at, duration_minutes
       FROM activities
       WHERE id = ?`,
    )
    .bind(id)
    .first<CommentActivityRow>();
}

function readOffset(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("offset") ?? 0);
  return Number.isInteger(value) && value >= 0
    ? Math.min(value, 10_000)
    : 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  await ensureSchema();
  const { id } = await params;
  const db = getD1();
  const activity = await getActivity(db, id);
  if (!activity) {
    return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  }
  if (
    activity.creator_email !== user.email &&
    (await hasBlockedRelationship(db, user.email, activity.creator_email))
  ) {
    return Response.json(
      { error: "차단 관계인 사용자의 모임 댓글은 볼 수 없어요." },
      { status: 403 },
    );
  }

  const offset = readOffset(request);
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
      .bind(id, user.email, user.email, COMMENT_PAGE_SIZE + 1, offset)
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
      .bind(id, user.email, user.email)
      .first<{ total: number }>(),
  ]);

  const hasMore = rows.results.length > COMMENT_PAGE_SIZE;
  const comments: ActivityComment[] = rows.results
    .slice(0, COMMENT_PAGE_SIZE)
    .map((row) => {
      const isMine = row.author_email === user.email;
      const viewerIsOwner = activity.creator_email === user.email;
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

  return Response.json(
    {
      comments,
      total: Number(count?.total ?? 0),
      hasMore,
      nextOffset: hasMore ? offset + COMMENT_PAGE_SIZE : null,
      locked: isCommentingClosed(activity),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function getOwnerCommentRecipients(
  db: D1Database,
  activityId: string,
  ownerEmail: string,
) {
  return db
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
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    await ensureSchema();
    const { id } = await params;
    const payload = await readJsonObject(request, 4_096);
    const content = cleanUserText(payload.content, COMMENT_MAX_LENGTH);
    if (!content) {
      return Response.json({ error: "댓글 내용을 입력해 주세요." }, { status: 400 });
    }
    if (hasUnsafeUserText(content)) {
      return Response.json(
        { error: "댓글에 연락처, 외부 계정 또는 부적절한 표현을 적을 수 없어요." },
        { status: 400 },
      );
    }

    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "activity-comment-create",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 15,
      windowSeconds: 5 * 60,
    });
    if (rateError) return rateError;

    const [activity, profile] = await Promise.all([
      getActivity(db, id),
      db
        .prepare(
          `SELECT nickname, onboarding_completed
           FROM user_profiles
           WHERE email = ?`,
        )
        .bind(user.email)
        .first<{ nickname: string; onboarding_completed: number }>(),
    ]);
    if (!activity) {
      return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
    }
    if (!profile?.onboarding_completed) {
      return Response.json({ error: "프로필을 먼저 완성해 주세요." }, { status: 403 });
    }
    if (isCommentingClosed(activity)) {
      return Response.json(
        { error: "모임 종료 24시간 후에는 댓글을 작성할 수 없어요." },
        { status: 409 },
      );
    }
    if (
      activity.creator_email !== user.email &&
      (await hasBlockedRelationship(db, user.email, activity.creator_email))
    ) {
      return Response.json(
        { error: "차단 관계인 사용자의 모임에는 댓글을 작성할 수 없어요." },
        { status: 403 },
      );
    }

    const commentId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO activity_comments (
           id, activity_id, author_email, content
         ) VALUES (?, ?, ?, ?)`,
      )
      .bind(commentId, id, user.email, content)
      .run();

    if (activity.creator_email === user.email) {
      const recipients = await getOwnerCommentRecipients(db, id, user.email);
      await createNotifications(
        recipients.results.map((recipient) => ({
          userEmail: recipient.recipient_email,
          activityId: id,
          type: "comment",
          title: "모임장이 댓글을 남겼어요",
          message: `${activity.title}: ${content.slice(0, 80)}`,
          dedupeKey: `comment:${commentId}:${recipient.recipient_email}`,
        })),
      );
    } else {
      await createNotifications([
        {
          userEmail: activity.creator_email,
          activityId: id,
          type: "comment",
          title: "새 모임 댓글이 등록됐어요",
          message: `${profile.nickname}: ${content.slice(0, 80)}`,
          dedupeKey: `comment:${commentId}:${activity.creator_email}`,
        },
      ]);
    }

    return Response.json({ id: commentId }, { status: 201 });
  } catch (error) {
    return requestErrorResponse(error);
  }
}

import { getSessionUser } from "../../../auth";
import { ensureSchema, getD1 } from "../../../../db";
import { createNotifications } from "../../../notification-store";
import { requireAdmin } from "../../../role-verification";
import { readJsonObject, requestErrorResponse } from "../../../security";

type ReportType = "activity" | "comment" | "user" | "rating";
type ModerationAction =
  | "dismiss"
  | "hide_content"
  | "warn"
  | "suspend_3d"
  | "suspend_7d"
  | "suspend_30d"
  | "ban";

const REPORT_TYPES: ReportType[] = ["activity", "comment", "user", "rating"];
const ACTIONS: ModerationAction[] = [
  "dismiss",
  "hide_content",
  "warn",
  "suspend_3d",
  "suspend_7d",
  "suspend_30d",
  "ban",
];

type ReportRow = {
  report_type: ReportType;
  report_id: string;
  reporter_email: string;
  target_email: string;
  reason: string;
  content: string;
  created_at: string;
  resolution: string | null;
  resolution_note: string | null;
};

async function requireModerator() {
  const user = await getSessionUser();
  if (!user) return { error: Response.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  const adminError = requireAdmin(user.email);
  return adminError ? { error: adminError } : { user };
}

export async function GET() {
  const auth = await requireModerator();
  if ("error" in auth) return auth.error;

  await ensureSchema();
  const db = getD1();
  const reports = await db
    .prepare(
      `SELECT * FROM (
         SELECT 'activity' AS report_type, r.id AS report_id,
                r.reporter_email, a.creator_email AS target_email,
                r.reason, a.title AS content, r.created_at,
                ma.action AS resolution, ma.note AS resolution_note
         FROM reports r
         JOIN activities a ON a.id = r.activity_id
         LEFT JOIN moderation_actions ma
           ON ma.report_type = 'activity' AND ma.report_id = r.id
         UNION ALL
         SELECT 'comment', cr.id, cr.reporter_email, c.author_email,
                cr.reason, c.content, cr.created_at, ma.action, ma.note
         FROM comment_reports cr
         JOIN activity_comments c ON c.id = cr.comment_id
         LEFT JOIN moderation_actions ma
           ON ma.report_type = 'comment' AND ma.report_id = cr.id
         UNION ALL
         SELECT 'user', ur.id, ur.reporter_email, ur.reported_email,
                ur.reason, '사용자 신고', ur.created_at, ma.action, ma.note
         FROM user_reports ur
         LEFT JOIN moderation_actions ma
           ON ma.report_type = 'user' AND ma.report_id = ur.id
         UNION ALL
         SELECT 'rating', rt.id, rt.rated_email, rt.rater_email,
                '받은 한줄 코멘트 신고', rt.comment, rt.reported_at,
                ma.action, ma.note
         FROM ratings rt
         LEFT JOIN moderation_actions ma
           ON ma.report_type = 'rating' AND ma.report_id = rt.id
         WHERE rt.reported_at IS NOT NULL
       )
       ORDER BY resolution IS NOT NULL ASC, created_at DESC
       LIMIT 100`,
    )
    .all<ReportRow>();

  const sanctions = await db
    .prepare(
      `SELECT id, user_email, kind, reason, expires_at, created_at
       FROM user_sanctions
       WHERE revoked_at IS NULL
         AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    .all<{
      id: string;
      user_email: string;
      kind: string;
      reason: string;
      expires_at: string | null;
      created_at: string;
    }>();

  return Response.json({
    reports: reports.results.map((row) => ({
      type: row.report_type,
      id: row.report_id,
      reporterEmail: row.reporter_email,
      targetEmail: row.target_email,
      reason: row.reason,
      content: row.content,
      createdAt: row.created_at,
      resolution: row.resolution,
      resolutionNote: row.resolution_note,
    })),
    sanctions: sanctions.results.map((row) => ({
      id: row.id,
      userEmail: row.user_email,
      kind: row.kind,
      reason: row.reason,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })),
  });
}

async function findReportTarget(db: D1Database, type: ReportType, id: string) {
  if (type === "activity") {
    return db.prepare(
      `SELECT a.creator_email AS target_email, r.activity_id AS content_id
       FROM reports r JOIN activities a ON a.id = r.activity_id WHERE r.id = ?`,
    ).bind(id).first<{ target_email: string; content_id: string }>();
  }
  if (type === "comment") {
    return db.prepare(
      `SELECT c.author_email AS target_email, cr.comment_id AS content_id
       FROM comment_reports cr JOIN activity_comments c ON c.id = cr.comment_id
       WHERE cr.id = ?`,
    ).bind(id).first<{ target_email: string; content_id: string }>();
  }
  if (type === "rating") {
    return db.prepare(
      `SELECT rater_email AS target_email, id AS content_id
       FROM ratings WHERE id = ? AND reported_at IS NOT NULL`,
    ).bind(id).first<{ target_email: string; content_id: string }>();
  }
  return db.prepare(
    `SELECT reported_email AS target_email, id AS content_id
     FROM user_reports WHERE id = ?`,
  ).bind(id).first<{ target_email: string; content_id: string }>();
}

export async function POST(request: Request) {
  const auth = await requireModerator();
  if ("error" in auth) return auth.error;

  try {
    const payload = await readJsonObject(request, 4_096);
    const reportTypeValue = typeof payload.reportType === "string" ? payload.reportType : "";
    const reportId = typeof payload.reportId === "string" ? payload.reportId.trim().slice(0, 100) : "";
    const actionValue = typeof payload.action === "string" ? payload.action : "";
    const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 300) : "";

    if (!REPORT_TYPES.includes(reportTypeValue as ReportType) || !ACTIONS.includes(actionValue as ModerationAction) || !reportId) {
      return Response.json({ error: "처리할 신고와 조치를 확인해 주세요." }, { status: 400 });
    }
    const reportType = reportTypeValue as ReportType;
    const action = actionValue as ModerationAction;
    if (action !== "dismiss" && note.length < 5) {
      return Response.json({ error: "조치 사유를 다섯 글자 이상 입력해 주세요." }, { status: 400 });
    }

    await ensureSchema();
    const db = getD1();
    const target = await findReportTarget(db, reportType, reportId);
    if (!target) return Response.json({ error: "신고를 찾을 수 없어요." }, { status: 404 });

    const statements = [
      db.prepare(
        `INSERT INTO moderation_actions (
           id, report_type, report_id, action, target_email, moderator_email, note
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(), reportType, reportId, action,
        target.target_email, auth.user.email, note,
      ),
    ];

    if (action === "hide_content") {
      if (reportType === "activity") {
        statements.push(db.prepare(`UPDATE activities SET status = 'hidden' WHERE id = ?`).bind(target.content_id));
      } else if (reportType === "comment") {
        statements.push(db.prepare(`UPDATE activity_comments SET status = 'hidden' WHERE id = ?`).bind(target.content_id));
      } else if (reportType === "rating") {
        statements.push(db.prepare(`UPDATE ratings SET comment_hidden = 1 WHERE id = ?`).bind(target.content_id));
      } else {
        return Response.json({ error: "사용자 신고에는 콘텐츠 숨김을 적용할 수 없어요." }, { status: 400 });
      }
    }

    if (["warn", "suspend_3d", "suspend_7d", "suspend_30d", "ban"].includes(action)) {
      const days = action === "suspend_3d" ? 3 : action === "suspend_7d" ? 7 : action === "suspend_30d" ? 30 : null;
      const expiresAt = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
      const kind = action === "warn" ? "warning" : action === "ban" ? "banned" : "suspended";
      statements.push(
        db.prepare(
          `INSERT INTO user_sanctions (
             id, user_email, kind, reason, expires_at, created_by
           ) VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), target.target_email, kind, note, expiresAt, auth.user.email),
      );
    }

    await db.batch(statements);
    if (action !== "dismiss") {
      await createNotifications([{
        userEmail: target.target_email,
        activityId: null,
        type: "moderation",
        title: "운영 정책 관련 안내",
        message: note,
        dedupeKey: `moderation:${reportType}:${reportId}:${action}`,
      }]);
    }
    return Response.json({ success: true });
  } catch (error) {
    return requestErrorResponse(error);
  }
}

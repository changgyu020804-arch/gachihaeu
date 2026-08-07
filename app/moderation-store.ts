import { createNotifications } from "./notification-store";
import type {
  ActiveSanction,
  ModerationAction,
  ModerationReport,
  ReportType,
} from "./moderation-types";

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

type SanctionRow = {
  id: string;
  user_email: string;
  kind: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
};

export class ModerationStoreError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function getModerationDashboard(db: D1Database) {
  const [reportRows, sanctionRows] = await Promise.all([
    db.prepare(
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
    ).all<ReportRow>(),
    db.prepare(
      `SELECT id, user_email, kind, reason, expires_at, created_at
       FROM user_sanctions
       WHERE revoked_at IS NULL
         AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
       ORDER BY created_at DESC
       LIMIT 100`,
    ).all<SanctionRow>(),
  ]);

  const reports: ModerationReport[] = reportRows.results.map((row) => ({
    type: row.report_type,
    id: row.report_id,
    reporterEmail: row.reporter_email,
    targetEmail: row.target_email,
    reason: row.reason,
    content: row.content,
    createdAt: row.created_at,
    resolution: row.resolution,
    resolutionNote: row.resolution_note,
  }));
  const sanctions: ActiveSanction[] = sanctionRows.results.map((row) => ({
    id: row.id,
    userEmail: row.user_email,
    kind: row.kind,
    reason: row.reason,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
  return { reports, sanctions };
}

async function findReportTarget(db: D1Database, type: ReportType, id: string) {
  const queries: Record<ReportType, string> = {
    activity: `SELECT a.creator_email AS target_email, r.activity_id AS content_id
               FROM reports r JOIN activities a ON a.id = r.activity_id WHERE r.id = ?`,
    comment: `SELECT c.author_email AS target_email, cr.comment_id AS content_id
              FROM comment_reports cr JOIN activity_comments c ON c.id = cr.comment_id
              WHERE cr.id = ?`,
    rating: `SELECT rater_email AS target_email, id AS content_id
             FROM ratings WHERE id = ? AND reported_at IS NOT NULL`,
    user: `SELECT reported_email AS target_email, id AS content_id
           FROM user_reports WHERE id = ?`,
  };
  return db.prepare(queries[type]).bind(id).first<{
    target_email: string;
    content_id: string;
  }>();
}

function contentHidingStatement(
  db: D1Database,
  type: ReportType,
  contentId: string,
) {
  if (type === "activity") return db.prepare(`UPDATE activities SET status = 'hidden' WHERE id = ?`).bind(contentId);
  if (type === "comment") return db.prepare(`UPDATE activity_comments SET status = 'hidden' WHERE id = ?`).bind(contentId);
  if (type === "rating") return db.prepare(`UPDATE ratings SET comment_hidden = 1 WHERE id = ?`).bind(contentId);
  throw new ModerationStoreError("사용자 신고에는 콘텐츠 숨김을 적용할 수 없어요.", 400);
}

function sanctionDetails(action: ModerationAction) {
  const days = action === "suspend_3d" ? 3 : action === "suspend_7d" ? 7 : action === "suspend_30d" ? 30 : null;
  return {
    kind: action === "warn" ? "warning" : action === "ban" ? "banned" : "suspended",
    expiresAt: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
  };
}

export async function applyModerationAction(
  db: D1Database,
  input: {
    reportType: ReportType;
    reportId: string;
    action: ModerationAction;
    note: string;
    moderatorEmail: string;
  },
) {
  const target = await findReportTarget(db, input.reportType, input.reportId);
  if (!target) throw new ModerationStoreError("신고를 찾을 수 없어요.", 404);

  const statements = [db.prepare(
    `INSERT INTO moderation_actions (
       id, report_type, report_id, action, target_email, moderator_email, note
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), input.reportType, input.reportId, input.action,
    target.target_email, input.moderatorEmail, input.note,
  )];

  if (input.action === "hide_content") {
    statements.push(contentHidingStatement(db, input.reportType, target.content_id));
  }
  if (["warn", "suspend_3d", "suspend_7d", "suspend_30d", "ban"].includes(input.action)) {
    const sanction = sanctionDetails(input.action);
    statements.push(db.prepare(
      `INSERT INTO user_sanctions (
         id, user_email, kind, reason, expires_at, created_by
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), target.target_email, sanction.kind,
      input.note, sanction.expiresAt, input.moderatorEmail,
    ));
  }

  await db.batch(statements);
  if (input.action !== "dismiss") {
    await createNotifications([{
      userEmail: target.target_email,
      activityId: null,
      type: "moderation",
      title: "운영 정책 관련 안내",
      message: input.note,
      dedupeKey: `moderation:${input.reportType}:${input.reportId}:${input.action}`,
    }]);
  }
}

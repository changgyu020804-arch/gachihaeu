import type { ReportType } from "@/lib/types/moderation";

export type ModerationReportRow = {
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

const REPORTS_UNION = `
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
  WHERE rt.reported_at IS NOT NULL`;

type ListModerationReportsOptions = {
  unresolvedOnly?: boolean;
  olderThanHours?: number;
  oldestFirst?: boolean;
  limit?: number;
};

export async function listModerationReportRows(
  db: D1Database,
  options: ListModerationReportsOptions = {},
) {
  const conditions: string[] = [];
  const bindings: Array<string | number> = [];

  if (options.unresolvedOnly) conditions.push("resolution IS NULL");
  if (options.olderThanHours !== undefined) {
    const hours = Math.max(1, Math.floor(options.olderThanHours));
    conditions.push("datetime(created_at) <= datetime('now', ?)");
    bindings.push(`-${hours} hours`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = options.oldestFirst
    ? "created_at ASC"
    : "resolution IS NOT NULL ASC, created_at DESC";
  const limit = Math.min(100, Math.max(1, options.limit ?? 100));

  const rows = await db
    .prepare(
      `SELECT * FROM (${REPORTS_UNION})
       ${where}
       ORDER BY ${orderBy}
       LIMIT ?`,
    )
    .bind(...bindings, limit)
    .all<ModerationReportRow>();
  return rows.results;
}

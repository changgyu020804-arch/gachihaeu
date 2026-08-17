import { getAdminEmails, getResendConfig } from "@/server/config/runtime-env";
import { createNotifications } from "@/server/services/notification.service";

type ModerationReportType = "activity" | "comment" | "user" | "rating";

type ModerationAlertInput = {
  reportType: ModerationReportType;
  reportId: string;
  reporterEmail: string;
  targetEmail: string;
  reason: string;
  content: string;
  alertKind?: "new" | "overdue";
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

async function claimAlertDelivery(
  db: D1Database,
  input: ModerationAlertInput,
) {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO moderation_alert_deliveries (
         report_type, report_id, alert_kind
       ) VALUES (?, ?, ?)`,
    )
    .bind(input.reportType, input.reportId, input.alertKind ?? "new")
    .run();
  return Number(result.meta.changes ?? 0) === 1;
}

async function releaseAlertDelivery(
  db: D1Database,
  input: ModerationAlertInput,
) {
  await db
    .prepare(
      `DELETE FROM moderation_alert_deliveries
       WHERE report_type = ? AND report_id = ? AND alert_kind = ?`,
    )
    .bind(input.reportType, input.reportId, input.alertKind ?? "new")
    .run();
}

export async function sendModerationAlert(
  db: D1Database,
  input: ModerationAlertInput,
) {
  if (!(await claimAlertDelivery(db, input))) return false;

  const admins = getAdminEmails();
  if (admins.length === 0) {
    await releaseAlertDelivery(db, input);
    console.error("Moderation alert skipped: ADMIN_EMAILS is empty");
    return false;
  }

  const isOverdue = input.alertKind === "overdue";
  const title = isOverdue
    ? "20시간 이상 미처리된 신고가 있어요"
    : "새로운 사용자 신고가 접수됐어요";
  const message = `${input.reportType} 신고 · 대상 ${input.targetEmail} · ${input.reason}`;

  try {
    await createNotifications(
      admins.map((adminEmail) => ({
        userEmail: adminEmail,
        activityId: null,
        type: "moderation" as const,
        title,
        message,
        dedupeKey: `moderation-alert:${input.alertKind ?? "new"}:${input.reportType}:${input.reportId}`,
      })),
    );

    const { apiKey, fromEmail } = getResendConfig();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: admins,
        subject: `[같이해U] ${title}`,
        html: `
          <h2>${escapeHtml(title)}</h2>
          <p><strong>유형:</strong> ${escapeHtml(input.reportType)}</p>
          <p><strong>신고자:</strong> ${escapeHtml(input.reporterEmail)}</p>
          <p><strong>대상:</strong> ${escapeHtml(input.targetEmail)}</p>
          <p><strong>사유:</strong> ${escapeHtml(input.reason)}</p>
          <p><strong>내용:</strong> ${escapeHtml(input.content).slice(0, 500)}</p>
          <p>운영자 화면에서 확인하고 24시간 안에 조치해 주세요.</p>
        `,
      }),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}`);
    return true;
  } catch (error) {
    await releaseAlertDelivery(db, input);
    console.error("Moderation alert delivery failed", error);
    return false;
  }
}

export async function sendOverdueModerationAlerts(db: D1Database) {
  const rows = await db
    .prepare(
      `SELECT * FROM (
         SELECT 'activity' AS report_type, r.id AS report_id,
                r.reporter_email, a.creator_email AS target_email,
                r.reason, a.title AS content, r.created_at
         FROM reports r
         JOIN activities a ON a.id = r.activity_id
         LEFT JOIN moderation_actions ma
           ON ma.report_type = 'activity' AND ma.report_id = r.id
         WHERE ma.id IS NULL
         UNION ALL
         SELECT 'comment', cr.id, cr.reporter_email, c.author_email,
                cr.reason, c.content, cr.created_at
         FROM comment_reports cr
         JOIN activity_comments c ON c.id = cr.comment_id
         LEFT JOIN moderation_actions ma
           ON ma.report_type = 'comment' AND ma.report_id = cr.id
         WHERE ma.id IS NULL
         UNION ALL
         SELECT 'user', ur.id, ur.reporter_email, ur.reported_email,
                ur.reason, '사용자 신고', ur.created_at
         FROM user_reports ur
         LEFT JOIN moderation_actions ma
           ON ma.report_type = 'user' AND ma.report_id = ur.id
         WHERE ma.id IS NULL
         UNION ALL
         SELECT 'rating', rt.id, rt.rated_email, rt.rater_email,
                '받은 한줄 코멘트 신고', rt.comment, rt.reported_at
         FROM ratings rt
         LEFT JOIN moderation_actions ma
           ON ma.report_type = 'rating' AND ma.report_id = rt.id
         WHERE rt.reported_at IS NOT NULL AND ma.id IS NULL
       )
       WHERE datetime(created_at) <= datetime('now', '-20 hours')
       ORDER BY created_at ASC
       LIMIT 100`,
    )
    .all<{
      report_type: ModerationReportType;
      report_id: string;
      reporter_email: string;
      target_email: string;
      reason: string;
      content: string;
    }>();

  for (const row of rows.results) {
    await sendModerationAlert(db, {
      reportType: row.report_type,
      reportId: row.report_id,
      reporterEmail: row.reporter_email,
      targetEmail: row.target_email,
      reason: row.reason,
      content: row.content,
      alertKind: "overdue",
    });
  }
}

import { getAdminEmails, getResendConfig } from "@/server/config/runtime-env";
import type { ReportType } from "@/lib/types/moderation";
import { listModerationReportRows } from "@/server/repositories/moderation-report.repository";
import { createNotifications } from "@/server/services/notification.service";

type ModerationAlertInput = {
  reportType: ReportType;
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
  const rows = await listModerationReportRows(db, {
    unresolvedOnly: true,
    olderThanHours: 20,
    oldestFirst: true,
  });

  for (const row of rows) {
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

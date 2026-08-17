import { cleanupExpiredRoleEvidence } from "@/server/services/role-evidence-cleanup";

const JOB_NAME = "daily-database-cleanup";
const DELETE_BATCH_SIZE = 500;

export type DatabaseCleanupResult = {
  executed: boolean;
  deletedRows: number;
};

function changedRows(result: D1Result<unknown>) {
  return Number(result.meta?.changes ?? 0);
}

async function acquireDailyLease(db: D1Database) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO maintenance_jobs (
         job_name, last_started_at, last_completed_at, last_deleted_rows, last_error
       ) VALUES (?, '1970-01-01 00:00:00', NULL, 0, '')`,
    )
    .bind(JOB_NAME)
    .run();

  const result = await db
    .prepare(
      `UPDATE maintenance_jobs
       SET last_started_at = CURRENT_TIMESTAMP,
           last_error = ''
       WHERE job_name = ?
         AND datetime(last_started_at) <= datetime('now', '-1 hour')
         AND (
           last_completed_at IS NULL
           OR datetime(last_completed_at) <= datetime('now', '-23 hours')
         )`,
    )
    .bind(JOB_NAME)
    .run();

  return changedRows(result) === 1;
}

export async function runDailyDatabaseCleanup(
  db: D1Database,
  evidenceBucket: R2Bucket,
): Promise<DatabaseCleanupResult> {
  if (!(await acquireDailyLease(db))) {
    return { executed: false, deletedRows: 0 };
  }

  try {
    const results = await db.batch([
      db.prepare(
        `DELETE FROM auth_codes
         WHERE email IN (
           SELECT email FROM auth_codes
           WHERE datetime(expires_at) <= datetime('now')
           LIMIT ${DELETE_BATCH_SIZE}
         )`,
      ),
      db.prepare(
        `DELETE FROM attendance_codes
         WHERE activity_id IN (
           SELECT activity_id FROM attendance_codes
           WHERE datetime(expires_at) <= datetime('now', '-1 day')
           LIMIT ${DELETE_BATCH_SIZE}
         )`,
      ),
      db.prepare(
        `DELETE FROM security_rate_limits
         WHERE rowid IN (
           SELECT rowid FROM security_rate_limits
           WHERE datetime(updated_at) < datetime('now', '-7 days')
           LIMIT ${DELETE_BATCH_SIZE}
         )`,
      ),
      db.prepare(
        `DELETE FROM notifications
         WHERE id IN (
           SELECT id FROM notifications
           WHERE read_at IS NOT NULL
             AND datetime(read_at) < datetime('now', '-90 days')
           LIMIT ${DELETE_BATCH_SIZE}
         )`,
      ),
      db.prepare(
        `DELETE FROM push_tokens
         WHERE token IN (
           SELECT token FROM push_tokens
           WHERE enabled = 0
             AND datetime(last_seen_at) < datetime('now', '-30 days')
           LIMIT ${DELETE_BATCH_SIZE}
         )`,
      ),
      db.prepare(
        `DELETE FROM security_audit_logs
         WHERE id IN (
           SELECT id FROM security_audit_logs
           WHERE datetime(created_at) < datetime('now', '-180 days')
           LIMIT ${DELETE_BATCH_SIZE}
         )`,
      ),
      db.prepare(
        `DELETE FROM moderation_alert_deliveries
         WHERE rowid IN (
           SELECT rowid FROM moderation_alert_deliveries
           WHERE datetime(created_at) < datetime('now', '-180 days')
           LIMIT ${DELETE_BATCH_SIZE}
         )`,
      ),
    ]);

    const evidenceRows = await cleanupExpiredRoleEvidence(db, evidenceBucket);
    const deletedRows =
      results.reduce((total, result) => total + changedRows(result), 0) +
      evidenceRows;

    await db.batch([
      db
        .prepare(
          `UPDATE maintenance_jobs
           SET last_completed_at = CURRENT_TIMESTAMP,
               last_deleted_rows = ?,
               last_error = ''
           WHERE job_name = ?`,
        )
        .bind(deletedRows, JOB_NAME),
      db.prepare("PRAGMA optimize"),
    ]);

    return { executed: true, deletedRows };
  } catch (error) {
    await db
      .prepare(
        `UPDATE maintenance_jobs
         SET last_error = ?
         WHERE job_name = ?`,
      )
      .bind(error instanceof Error ? error.name : "CleanupError", JOB_NAME)
      .run()
      .catch(() => undefined);
    throw error;
  }
}

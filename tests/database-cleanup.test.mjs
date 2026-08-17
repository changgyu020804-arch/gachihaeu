import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("cleans temporary records and checks overdue reports on schedule", async () => {
  const [cleanup, schema, worker, viteConfig] = await Promise.all([
    readFile(new URL("server/services/database-cleanup.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("vite.config.ts", root), "utf8"),
  ]);

  assert.match(schema, /maintenance_jobs/);
  assert.match(schema, /notifications_read_at_idx/);
  assert.match(cleanup, /DELETE_BATCH_SIZE = 500/);
  assert.match(cleanup, /DELETE FROM auth_codes/);
  assert.match(cleanup, /DELETE FROM attendance_codes/);
  assert.match(cleanup, /DELETE FROM security_rate_limits/);
  assert.match(cleanup, /DELETE FROM notifications/);
  assert.match(cleanup, /DELETE FROM push_tokens/);
  assert.match(cleanup, /DELETE FROM security_audit_logs/);
  assert.match(cleanup, /DELETE FROM moderation_alert_deliveries/);
  assert.match(cleanup, /'-23 hours'/);
  assert.match(cleanup, /PRAGMA optimize/);
  assert.match(worker, /async scheduled/);
  assert.match(worker, /runDailyDatabaseCleanup\(env\.DB, env\.ROLE_EVIDENCE\)/);
  assert.match(worker, /sendOverdueModerationAlerts\(env\.DB\)/);
  assert.doesNotMatch(worker, /runDailyDatabaseCleanup\(env\.DB.+fetch/s);
  assert.match(viteConfig, /crons: \["0 \* \* \* \*"\]/);
});

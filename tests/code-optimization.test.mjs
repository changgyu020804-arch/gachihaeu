import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("reuses imported HMAC keys instead of importing them for every request", async () => {
  const [sessionSource, requestSource] = await Promise.all([
    readSource("server/auth/session.ts"),
    readSource("server/security/request.ts"),
  ]);

  assert.match(sessionSource, /signingKeyPromise/);
  assert.match(requestSource, /rateLimitKeyPromise/);
});

test("batches rate-limit writes and centralizes moderation report queries", async () => {
  const [requestSource, repositorySource, moderationSource, alertSource] =
    await Promise.all([
      readSource("server/security/request.ts"),
      readSource("server/repositories/moderation-report.repository.ts"),
      readSource("server/repositories/moderation.repository.ts"),
      readSource("server/services/moderation-alert.service.ts"),
    ]);

  assert.match(requestSource, /await db\.batch\(/);
  assert.match(repositorySource, /const REPORTS_UNION/);
  assert.match(moderationSource, /listModerationReportRows\(db\)/);
  assert.match(alertSource, /listModerationReportRows\(db, \{/);
  assert.doesNotMatch(moderationSource, /UNION ALL/);
  assert.doesNotMatch(alertSource, /UNION ALL/);
});

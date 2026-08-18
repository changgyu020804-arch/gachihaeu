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

test("loads rating eligibility once and upserts ratings atomically", async () => {
  const [routeSource, repositorySource, profileSource] = await Promise.all([
    readSource("app/api/ratings/route.ts"),
    readSource("server/repositories/rating-write.repository.ts"),
    readSource("app/api/profile/route.ts"),
  ]);

  assert.match(routeSource, /getRatingContext/);
  assert.match(routeSource, /saveRating/);
  assert.match(repositorySource, /has_blocked_relationship/);
  assert.match(repositorySource, /ON CONFLICT\(activity_id, rater_email, rated_email\) DO UPDATE/);
  assert.doesNotMatch(routeSource, /SELECT 1 FROM ratings|UPDATE ratings|INSERT INTO ratings/);
  assert.match(profileSource, /await db\.batch\(\[/);
});

test("keeps repeat app launches light and batches home bootstrap reads", async () => {
  const [
    workerSource,
    homeClientSource,
    homeActivitiesSource,
    sessionSource,
    securitySource,
    viewerSource,
    activityRepositorySource,
    pageSource,
    staticHeadersSource,
  ] = await Promise.all([
    readSource("worker/index.ts"),
    readSource("app/home-client.tsx"),
    readSource("hooks/use-home-activities.ts"),
    readSource("server/auth/session.ts"),
    readSource("server/services/account-security.ts"),
    readSource("server/services/viewer.ts"),
    readSource("server/repositories/activity.repository.ts"),
    readSource("app/page.tsx"),
    readSource("public/_headers"),
  ]);

  assert.match(workerSource, /max-age=31536000, immutable/);
  assert.match(staticHeadersSource, /\/assets\/\*/);
  assert.match(staticHeadersSource, /max-age=31536000, immutable/);
  assert.match(homeClientSource, /lazy\(\(\) =>/);
  assert.match(homeClientSource, /<Suspense fallback=\{null\}>/);
  assert.match(
    homeActivitiesSource,
    /if \(isInitialServerPage\) \{[\s\S]*?firstLoadRef\.current = false;[\s\S]*?return;/,
  );
  assert.match(sessionSource, /getSessionBootstrap/);
  assert.match(securitySource, /const \[securityResult, profileResult\] = await db\.batch/);
  assert.doesNotMatch(viewerSource, /getD1|SELECT nickname/);
  assert.match(activityRepositorySource, /getActivityHomeData/);
  assert.match(activityRepositorySource, /await db\.batch\(\[/);
  assert.match(pageSource, /getActivityHomeData/);
});

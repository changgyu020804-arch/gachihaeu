import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function read(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

async function collectRouteFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectRouteFiles(fullPath)));
    } else if (entry.name === "route.ts") {
      files.push(fullPath);
    }
  }
  return files;
}

test("removes the fixed administrator login and hard-coded secrets", async () => {
  const [sendCode, auth, loginSheet] = await Promise.all([
    read("app/api/auth/send-code/route.ts"),
    read("server/auth/session.ts"),
    read("components/auth/login-sheet.tsx"),
  ]);
  const combined = `${sendCode}\n${auth}\n${loginSheet}`;

  assert.doesNotMatch(combined, /ADMIN_EMAIL|admin@uos\.ac\.kr|000000/);
  assert.doesNotMatch(combined, /re_[A-Za-z0-9_-]{10,}/);
  assert.match(sendCode, /getResendConfig/);
  assert.match(auth, /getJwtSecret/);
});

test("stores one-time codes as hashes and tracks failures", async () => {
  const [schema, verifyRoute, sendRoute] = await Promise.all([
    read("db/schema.ts"),
    read("app/api/auth/verify-code/route.ts"),
    read("app/api/auth/send-code/route.ts"),
  ]);

  assert.match(schema, /codeHash: text\("code_hash"\)/);
  assert.match(schema, /attempts: integer\("attempts"\)/);
  assert.doesNotMatch(schema, /code: text\("code"\)/);
  assert.match(verifyRoute, /constantTimeEqual/);
  assert.match(verifyRoute, /MAX_CODE_ATTEMPTS = 5/);
  assert.match(verifyRoute, /DELETE FROM auth_codes/);
  assert.match(verifyRoute, /datetime\(expires_at\) > datetime\('now'\)/);
  assert.match(sendRoute, /datetime\(expires_at\) <= datetime\('now'\)/);
});

test("protects unsafe API requests and adds browser security headers", async () => {
  const worker = await read("worker/index.ts");

  assert.match(worker, /gachihaeu-uos\.changgyu020804\.chatgpt\.site/);
  assert.match(worker, /www\.gachihaeu\.com/);
  assert.match(worker, /Response\.redirect\(url\.toString\(\), 308\)/);
  assert.match(worker, /MUTATION_METHODS/);
  assert.match(worker, /sec-fetch-site/);
  assert.match(worker, /X-Content-Type-Options/);
  assert.match(worker, /X-Frame-Options/);
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /Strict-Transport-Security/);
});

test("requires a session for every non-authentication write route", async () => {
  const apiRoot = path.join(projectRoot, "app", "api");
  const routeFiles = await collectRouteFiles(apiRoot);

  for (const routeFile of routeFiles) {
    const source = await readFile(routeFile, "utf8");
    const isWriteRoute =
      /export async function (POST|PUT|PATCH|DELETE)/.test(source);
    const isAuthenticationRoute = routeFile.includes(
      `${path.sep}api${path.sep}auth${path.sep}`,
    );

    if (isWriteRoute && !isAuthenticationRoute) {
      assert.match(
        source,
        /getSessionUser/,
        `${path.relative(projectRoot, routeFile)} must verify the session`,
      );
    }
  }
});

test("rate limits authentication and abuse-prone mutations", async () => {
  const files = await Promise.all([
    read("app/api/auth/send-code/route.ts"),
    read("app/api/auth/verify-code/route.ts"),
    read("app/api/ratings/route.ts"),
    read("app/api/activities/[id]/report/route.ts"),
    read("app/api/users/[email]/report/route.ts"),
    read("app/api/users/[email]/block/route.ts"),
  ]);

  for (const source of files) {
    assert.match(source, /enforceRateLimit/);
  }
});

test("keeps login while requiring one-time profile onboarding", async () => {
  const [
    auth,
    schema,
    loginSheet,
    profileSetupForm,
    profileSheet,
    profileOverview,
    campusRoleBadge,
    profileStyles,
    profileRoute,
    publicProfileRoute,
    meRoute,
  ] = await Promise.all([
    read("server/auth/session.ts"),
    read("db/schema.ts"),
    read("components/auth/login-sheet.tsx"),
    read("components/profile/profile-setup-form.tsx"),
    read("components/profile/profile-sheet.tsx"),
    read("components/profile/profile-overview.tsx"),
    read("components/profile/campus-role-badge.tsx"),
    read("app/styles/profiles.css"),
    read("app/api/profile/route.ts"),
    read("app/api/ratings/[email]/route.ts"),
    read("app/api/auth/me/route.ts"),
  ]);

  assert.match(auth, /SESSION_IDLE_SECONDS = 30 \* 24 \* 60 \* 60/);
  assert.match(auth, /SESSION_ABSOLUTE_SECONDS = 180 \* 24 \* 60 \* 60/);
  assert.match(auth, /auth_time/);
  assert.match(meRoute, /shouldRefreshSession/);
  assert.match(schema, /gender: text\("gender"\)/);
  assert.match(schema, /campusRole: text\("campus_role"\)/);
  assert.match(
    schema,
    /onboardingCompleted: integer\("onboarding_completed"\)/,
  );
  assert.match(loginSheet, /type LoginStep = "email" \| "code" \| "profile" \| "review"/);
  assert.match(profileSetupForm, /GENDERS/);
  assert.match(profileSetupForm, /CAMPUS_ROLES/);
  assert.match(profileSetupForm, /DEPARTMENTS/);
  assert.match(profileSheet, /ProfileOverview/);
  assert.match(profileOverview, /CampusRoleBadge/);
  assert.match(campusRoleBadge, /학생: "student"/);
  assert.match(campusRoleBadge, /교수: "professor"/);
  assert.match(campusRoleBadge, /교직원: "staff"/);
  assert.match(profileStyles, /\.campus-role-badge\.student/);
  assert.match(profileStyles, /\.campus-role-badge\.professor/);
  assert.match(profileStyles, /\.campus-role-badge\.staff/);
  assert.match(publicProfileRoute, /campusRole/);
  assert.match(profileRoute, /onboarding_completed = 1/);
});

test("prevents duplicate nicknames in the UI, API, and database", async () => {
  const [
    schema,
    migration,
    profileRoute,
    nicknameRoute,
    nicknameField,
    nicknameHelpers,
  ] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0010_fine_brother_voodoo.sql"),
    read("app/api/profile/route.ts"),
    read("app/api/profile/nickname/route.ts"),
    read("components/profile/nickname-field.tsx"),
    read("lib/validation/nickname.ts"),
  ]);

  assert.match(schema, /nicknameNormalized: text\("nickname_normalized"\)/);
  assert.match(schema, /uniqueIndex\("user_profiles_nickname_normalized_idx"\)/);
  assert.match(migration, /UPDATE `user_profiles`/);
  assert.match(migration, /CREATE UNIQUE INDEX `user_profiles_nickname_normalized_idx`/);
  assert.match(profileRoute, /status: 409/);
  assert.match(profileRoute, /isNicknameConflictError/);
  assert.match(nicknameRoute, /getSessionUser/);
  assert.match(nicknameRoute, /email <> \?/);
  assert.match(nicknameField, /api\/profile\/nickname/);
  assert.match(nicknameField, /AbortController/);
  assert.match(nicknameHelpers, /normalize\("NFKC"\)/);
  assert.match(nicknameHelpers, /toLocaleLowerCase\("ko-KR"\)/);
});

test("keeps activity comments bounded, moderated, and permission checked", async () => {
  const [
    schema,
    migration,
    commentsRoute,
    commentsStore,
    commentRoute,
    reportRoute,
    commentsUi,
    commentsHook,
    moderation,
  ] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0011_many_emma_frost.sql"),
    read("app/api/activities/[id]/comments/route.ts"),
    read("server/repositories/activity-comment.repository.ts"),
    read("app/api/activities/[id]/comments/[commentId]/route.ts"),
    read("app/api/activities/[id]/comments/[commentId]/report/route.ts"),
    read("components/activity/activity-comments.tsx"),
    read("hooks/use-activity-comments.ts"),
    read("server/validation/content-moderation.ts"),
  ]);

  assert.match(schema, /activityComments = sqliteTable/);
  assert.match(schema, /commentReports = sqliteTable/);
  assert.match(migration, /CREATE TABLE `activity_comments`/);
  assert.match(migration, /activity_comments_activity_created_idx/);
  assert.match(commentsStore, /COMMENT_PAGE_SIZE \+ 1/);
  assert.match(commentsStore, /user_blocks/);
  assert.match(commentsRoute, /isCommentingClosed/);
  assert.match(commentsRoute, /activity-comment-create/);
  assert.match(commentRoute, /creator_email !== user\.email/);
  assert.match(commentRoute, /status = 'hidden'/);
  assert.match(reportRoute, /comment_reports/);
  assert.match(commentsUi, /COMMENT_RENDER_LIMIT/);
  assert.match(commentsUi, /useActivityComments/);
  assert.match(commentsHook, /AbortController/);
  assert.match(moderation, /CONTACT_PATTERN/);
});

test("deletes the account and all directly associated user data", async () => {
  const [route, deletion, profileSheet, deletionPanel] = await Promise.all([
    read("app/api/account/route.ts"),
    read("server/services/account-deletion.ts"),
    read("components/profile/profile-sheet.tsx"),
    read("components/profile/account-deletion-panel.tsx"),
  ]);

  assert.match(route, /export async function DELETE/);
  assert.match(route, /rejectCrossOriginMutation/);
  assert.match(route, /getSessionUser/);
  assert.match(route, /deleteSessionCookies/);
  assert.match(route, /payload\.confirmation !== DELETE_CONFIRMATION/);

  for (const table of [
    "notifications",
    "reports",
    "comment_reports",
    "activity_comments",
    "ratings",
    "participants",
    "waitlist",
    "user_reports",
    "user_blocks",
    "auth_codes",
    "role_verification_requests",
    "user_profiles",
    "activities",
    "security_audit_logs",
    "security_rate_limits",
    "attendance_codes",
    "moderation_actions",
    "user_sanctions",
  ]) {
    assert.match(deletion, new RegExp(`DELETE FROM ${table}`));
  }

  assert.match(profileSheet, /AccountDeletionPanel/);
  assert.match(deletionPanel, /계정 영구 삭제/);
  assert.match(deletionPanel, /confirmation !== "탈퇴"/);
});

test("isolates the App Review account and never stores its password in source", async () => {
  const [runtimeEnv, reviewRoute, reviewData, activitiesStore, loginSheet] = await Promise.all([
    read("server/config/runtime-env.ts"),
    read("app/api/auth/review-login/route.ts"),
    read("server/services/review-account.ts"),
    read("server/repositories/activity.repository.ts"),
    read("components/auth/login-sheet.tsx"),
  ]);
  assert.match(runtimeEnv, /APP_REVIEW_PASSWORD/);
  assert.match(reviewRoute, /getAppReviewConfig/);
  assert.match(reviewRoute, /constantTimeEqual/);
  assert.match(reviewRoute, /seedReviewData/);
  assert.match(reviewData, /@review\.gachihaeu\.com/);
  assert.match(activitiesStore, /reviewMode/);
  assert.match(activitiesStore, /NOT LIKE '%@review\.gachihaeu\.com'/);
  assert.match(loginSheet, /review-login/);
  assert.doesNotMatch(`${runtimeEnv}\n${reviewRoute}\n${loginSheet}`, /APP_REVIEW_PASSWORD\s*=\s*["'][^"']+/);
});

test("supports administrator moderation and active account sanctions", async () => {
  const [schema, route, store, types, panel, worker] = await Promise.all([
    read("db/schema.ts"),
    read("app/api/admin/moderation/route.ts"),
    read("server/repositories/moderation.repository.ts"),
    read("lib/types/moderation.ts"),
    read("components/admin/admin-moderation-panel.tsx"),
    read("worker/index.ts"),
  ]);
  assert.match(schema, /moderationActions = sqliteTable/);
  assert.match(schema, /userSanctions = sqliteTable/);
  assert.match(route, /requireAdmin/);
  assert.match(types, /suspend_30d/);
  assert.match(store, /UPDATE activities SET status = 'hidden'/);
  assert.match(panel, /신고·제재 관리/);
  assert.match(worker, /user_sanctions/);
  assert.match(worker, /kind IN \('suspended', 'banned'\)/);
});

test("checks attendance with a short-lived hashed six digit number", async () => {
  const [schema, auth, codeRoute, checkInRoute, ui] = await Promise.all([
    read("db/schema.ts"),
    read("server/auth/session.ts"),
    read("app/api/activities/[id]/attendance-code/route.ts"),
    read("app/api/activities/[id]/check-in/route.ts"),
    read("components/activity/attendance-check-in.tsx"),
  ]);
  assert.match(schema, /attendanceCodes = sqliteTable/);
  assert.match(auth, /hashAttendanceCode/);
  assert.match(codeRoute, /generateAuthCode/);
  assert.match(codeRoute, /code_hash/);
  assert.match(codeRoute, /getGenerationUnavailableReason/);
  assert.match(codeRoute, /canGenerate/);
  assert.doesNotMatch(schema, /code: text\("code"\)/);
  assert.match(checkInRoute, /maximum: 5/);
  assert.match(checkInRoute, /constantTimeEqual/);
  assert.match(ui, /6자리 출석번호/);
  assert.match(ui, /unavailableReason/);
});

test("publishes launch policies and support contact", async () => {
  const [privacy, terms, community, support, links] = await Promise.all([
    read("app/privacy/page.tsx"),
    read("app/terms/page.tsx"),
    read("app/community/page.tsx"),
    read("app/support/page.tsx"),
    read("components/layout/policy-links.tsx"),
  ]);
  assert.match(privacy, /개인정보처리방침/);
  assert.match(privacy, /Cloudflare D1/);
  assert.match(terms, /같이해U 이용약관/);
  assert.match(community, /커뮤니티 운영정책/);
  assert.match(support, /changgyu1939@uos\.ac\.kr/);
  assert.match(links, /\/privacy/);
  assert.match(links, /\/support/);
});

test("verifies professor and staff roles with private evidence and admin review", async () => {
  const [
    hosting,
    schema,
    migration,
    profileRoute,
    profileRole,
    verificationRoute,
    evidenceUpload,
    adminRoute,
    evidenceRoute,
    verificationUi,
    adminUi,
    runtimeEnv,
    accountRoute,
    worker,
    databaseCleanup,
    nextConfig,
  ] = await Promise.all([
    read(".openai/hosting.json"),
    read("db/schema.ts"),
    read("drizzle/0012_whole_kang.sql"),
    read("app/api/profile/route.ts"),
    read("server/policies/profile-role.ts"),
    read("app/api/role-verification/route.ts"),
    read("server/services/role-evidence-upload.ts"),
    read("app/api/admin/role-verifications/[id]/route.ts"),
    read("app/api/admin/role-verifications/[id]/evidence/route.ts"),
    read("components/profile/role-verification-panel.tsx"),
    read("components/admin/admin-verification-panel.tsx"),
    read("server/config/runtime-env.ts"),
    read("app/api/account/route.ts"),
    read("worker/index.ts"),
    read("server/services/database-cleanup.ts"),
    read("next.config.ts"),
  ]);

  assert.match(hosting, /"r2": "ROLE_EVIDENCE"/);
  assert.match(schema, /roleVerificationRequests = sqliteTable/);
  assert.match(schema, /roleVerificationStatus: text\("role_verification_status"\)/);
  assert.match(migration, /CREATE TABLE `role_verification_requests`/);
  assert.match(migration, /WHERE `campus_role` IN \('교수', '교직원'\)/);
  assert.match(profileRoute, /resolveProfileRole/);
  assert.match(profileRole, /publicCampusRole: keepsApprovedRole \? selectedRole : ""/);
  assert.match(evidenceUpload, /MAX_EVIDENCE_BYTES = 5 \* 1024 \* 1024/);
  assert.match(nextConfig, /bodySizeLimit: "6mb"/);
  assert.match(verificationUi, /evidence\.size > MAX_EVIDENCE_BYTES/);
  assert.match(verificationUi, /response\.status === 413/);
  assert.match(evidenceUpload, /detectEvidenceContentType/);
  assert.match(evidenceUpload, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(verificationRoute, /getRoleEvidenceBucket\(\)\.put|bucket\.put/);
  assert.match(adminRoute, /requireAdmin/);
  assert.match(adminRoute, /verification\.user_email === user\.email/);
  assert.match(adminRoute, /evidence_delete_after = datetime\('now', '\+7 days'\)/);
  assert.match(evidenceRoute, /Cache-Control": "private, no-store/);
  assert.match(verificationUi, /개인정보 처리 안내/);
  assert.match(verificationUi, /JPG, PNG, PDF · 최대 5MB/);
  assert.match(adminUi, /직위 인증 관리/);
  assert.match(runtimeEnv, /ADMIN_EMAILS/);
  assert.match(accountRoute, /getRoleEvidenceBucket\(\)\.delete/);
  assert.match(databaseCleanup, /cleanupExpiredRoleEvidence/);
  assert.match(worker, /runDailyDatabaseCleanup/);
  assert.match(worker, /ctx\.waitUntil/);
});

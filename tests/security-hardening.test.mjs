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
    read("app/auth.ts"),
    read("app/components/login-sheet.tsx"),
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
    loginStepForms,
    profileSheet,
    profileOverview,
    campusRoleBadge,
    profileStyles,
    profileRoute,
    publicProfileRoute,
    meRoute,
  ] = await Promise.all([
    read("app/auth.ts"),
    read("db/schema.ts"),
    read("app/components/login-sheet.tsx"),
    read("app/components/login-step-forms.tsx"),
    read("app/components/profile-sheet.tsx"),
    read("app/components/profile-overview.tsx"),
    read("app/components/campus-role-badge.tsx"),
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
  assert.match(loginSheet, /type LoginStep = "email" \| "code" \| "profile"/);
  assert.match(loginStepForms, /GENDERS/);
  assert.match(loginStepForms, /CAMPUS_ROLES/);
  assert.match(loginStepForms, /DEPARTMENTS/);
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
    read("app/components/nickname-field.tsx"),
    read("app/nickname.ts"),
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
    commentRoute,
    reportRoute,
    commentsUi,
    moderation,
  ] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0011_many_emma_frost.sql"),
    read("app/api/activities/[id]/comments/route.ts"),
    read("app/api/activities/[id]/comments/[commentId]/route.ts"),
    read("app/api/activities/[id]/comments/[commentId]/report/route.ts"),
    read("app/components/activity-comments.tsx"),
    read("app/content-moderation.ts"),
  ]);

  assert.match(schema, /activityComments = sqliteTable/);
  assert.match(schema, /commentReports = sqliteTable/);
  assert.match(migration, /CREATE TABLE `activity_comments`/);
  assert.match(migration, /activity_comments_activity_created_idx/);
  assert.match(commentsRoute, /COMMENT_PAGE_SIZE \+ 1/);
  assert.match(commentsRoute, /user_blocks/);
  assert.match(commentsRoute, /isCommentingClosed/);
  assert.match(commentsRoute, /activity-comment-create/);
  assert.match(commentRoute, /creator_email !== user\.email/);
  assert.match(commentRoute, /status = 'hidden'/);
  assert.match(reportRoute, /comment_reports/);
  assert.match(commentsUi, /COMMENT_RENDER_LIMIT/);
  assert.match(commentsUi, /AbortController/);
  assert.match(moderation, /CONTACT_PATTERN/);
});

test("deletes the account and all directly associated user data", async () => {
  const [route, deletion, profileSheet, deletionPanel] = await Promise.all([
    read("app/api/account/route.ts"),
    read("app/account-deletion.ts"),
    read("app/components/profile-sheet.tsx"),
    read("app/components/account-deletion-panel.tsx"),
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
  ]) {
    assert.match(deletion, new RegExp(`DELETE FROM ${table}`));
  }

  assert.match(profileSheet, /AccountDeletionPanel/);
  assert.match(deletionPanel, /계정 영구 삭제/);
  assert.match(deletionPanel, /confirmation !== "탈퇴"/);
});

test("verifies professor and staff roles with private evidence and admin review", async () => {
  const [
    hosting,
    schema,
    migration,
    profileRoute,
    verificationRoute,
    adminRoute,
    evidenceRoute,
    verificationUi,
    adminUi,
    runtimeEnv,
    accountRoute,
    worker,
  ] = await Promise.all([
    read(".openai/hosting.json"),
    read("db/schema.ts"),
    read("drizzle/0012_whole_kang.sql"),
    read("app/api/profile/route.ts"),
    read("app/api/role-verification/route.ts"),
    read("app/api/admin/role-verifications/[id]/route.ts"),
    read("app/api/admin/role-verifications/[id]/evidence/route.ts"),
    read("app/components/role-verification-panel.tsx"),
    read("app/components/admin-verification-panel.tsx"),
    read("app/runtime-env.ts"),
    read("app/api/account/route.ts"),
    read("worker/index.ts"),
  ]);

  assert.match(hosting, /"r2": "ROLE_EVIDENCE"/);
  assert.match(schema, /roleVerificationRequests = sqliteTable/);
  assert.match(schema, /roleVerificationStatus: text\("role_verification_status"\)/);
  assert.match(migration, /CREATE TABLE `role_verification_requests`/);
  assert.match(migration, /WHERE `campus_role` IN \('교수', '교직원'\)/);
  assert.match(profileRoute, /publicCampusRole = keepsApprovedRole \? campusRole : ""/);
  assert.match(verificationRoute, /MAX_EVIDENCE_BYTES = 5 \* 1024 \* 1024/);
  assert.match(verificationRoute, /detectedContentType/);
  assert.match(verificationRoute, /crypto\.subtle\.digest\("SHA-256"/);
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
  assert.match(worker, /cleanupExpiredRoleEvidence/);
  assert.match(worker, /ctx\.waitUntil/);
});

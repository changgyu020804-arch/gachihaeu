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
  assert.match(profileSheet, /profile-position-badge/);
  assert.match(profileStyles, /\.profile-position-badge/);
  assert.match(publicProfileRoute, /campusRole/);
  assert.match(profileRoute, /onboarding_completed = 1/);
});

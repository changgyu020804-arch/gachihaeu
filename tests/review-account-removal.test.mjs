import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDirectory = new URL("../drizzle/", import.meta.url);

async function applyMigration(db, filename) {
  const sql = await readFile(new URL(filename, migrationsDirectory), "utf8");
  for (const statement of sql
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    db.exec(statement);
  }
}

test("deletes only retired App Review accounts and demo activities", async () => {
  const db = new DatabaseSync(":memory:");
  const migrations = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  const removalMigration = migrations.find((filename) =>
    filename.startsWith("0018_remove_app_review_account"),
  );
  assert.ok(removalMigration);
  const removalIndex = migrations.indexOf(removalMigration);

  for (const migration of migrations.slice(0, removalIndex)) {
    await applyMigration(db, migration);
  }

  db.exec(`
    INSERT INTO user_profiles (
      email, nickname, nickname_normalized, gender, campus_role, department,
      bio, preferred_sports, onboarding_completed
    ) VALUES
      ('apple-review@review.gachihaeu.com', 'AppReviewer', 'appreviewer', '남성', '학생', '기타', '', '', 1),
      ('student@uos.ac.kr', '시립대학생', '시립대학생', '여성', '학생', '경영학과', '', '', 1);

    INSERT INTO activities (
      id, creator_email, creator_name, sport, title, venue, starts_at,
      duration_minutes, capacity, level, description, status,
      facility_reserved, cancellation_deadline_minutes
    ) VALUES
      ('review-demo-running', 'apple-review@review.gachihaeu.com', 'AppReviewer',
       '러닝', '심사용 러닝', '대운동장 러닝트랙', '2030-01-01T09:00:00.000Z',
       60, 8, '누구나', '심사용 모임', 'open', 1, 60),
      ('real-running', 'student@uos.ac.kr', '시립대학생',
       '러닝', '실제 러닝', '대운동장 러닝트랙', '2030-01-02T09:00:00.000Z',
       60, 8, '누구나', '실제 모임', 'open', 1, 60);

    INSERT INTO participants (activity_id, user_email, display_name) VALUES
      ('review-demo-running', 'apple-review@review.gachihaeu.com', 'AppReviewer'),
      ('real-running', 'student@uos.ac.kr', '시립대학생');

    INSERT INTO security_rate_limits (
      action, key_hash, window_bucket, request_count
    ) VALUES
      ('app-review-login', 'review-hash', 1, 1),
      ('activity-create', 'student-hash', 1, 1);
  `);

  await applyMigration(db, removalMigration);

  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM user_profiles").get().count,
    1,
  );
  assert.equal(
    db.prepare("SELECT email FROM user_profiles").get().email,
    "student@uos.ac.kr",
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM activities").get().count,
    1,
  );
  assert.equal(
    db.prepare("SELECT id FROM activities").get().id,
    "real-running",
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM participants").get().count,
    1,
  );
  assert.equal(
    db.prepare("SELECT action FROM security_rate_limits").get().action,
    "activity-create",
  );
});

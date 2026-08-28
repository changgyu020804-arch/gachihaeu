import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { resetIrDemoData } from "../server/services/ir-demo-data.ts";

const migrationsDirectory = new URL("../drizzle/", import.meta.url);

async function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrations = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of migrations) {
    const sql = await readFile(new URL(filename, migrationsDirectory), "utf8");
    for (const statement of sql
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean)) {
      sqlite.exec(statement);
    }
  }
  return sqlite;
}

function createD1(sqlite) {
  function prepare(sql) {
    const statement = sqlite.prepare(sql);
    let bindings = [];
    return {
      bind(...values) {
        bindings = values;
        return this;
      },
      run() {
        const result = statement.run(...bindings);
        return Promise.resolve({
          meta: { changes: Number(result.changes ?? 0) },
          results: [],
        });
      },
    };
  }

  return {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

test("prepares exactly two ratings before the live IR evaluation", async () => {
  const sqlite = await createDatabase();
  const d1 = createD1(sqlite);
  const owner = {
    email: "presenter@uos.ac.kr",
    displayName: "발표자",
  };

  sqlite
    .prepare(
      `INSERT INTO user_profiles (
         email, nickname, nickname_normalized, onboarding_completed
       ) VALUES (?, ?, ?, 1)`,
    )
    .run(owner.email, owner.displayName, "발표자");

  const demo = await resetIrDemoData(d1, owner);
  const before = sqlite
    .prepare(
      `SELECT
         COUNT(*) AS rating_count,
         AVG(skill_score) AS skill_score,
         AVG(manner_score) AS manner_score
       FROM ratings
       WHERE rated_email = ? AND evaluation_version = 'skill_manner_v2'`,
    )
    .get(demo.participantEmail);
  const participant = sqlite
    .prepare(
      `SELECT attendance_status
       FROM participants
       WHERE activity_id = ? AND user_email = ?`,
    )
    .get(demo.activityId, demo.participantEmail);

  assert.equal(before.rating_count, 2);
  assert.equal(before.skill_score, 4.5);
  assert.equal(before.manner_score, 4.5);
  assert.equal(participant.attendance_status, "pending");

  sqlite
    .prepare(
      `UPDATE participants SET attendance_status = 'attended'
       WHERE activity_id = ? AND user_email = ?`,
    )
    .run(demo.activityId, demo.participantEmail);
  sqlite
    .prepare(
      `INSERT INTO ratings (
         id, activity_id, rater_email, rated_email, trust_score,
         skill_score, manner_score, rating_type, evaluation_version
       ) VALUES ('ir-demo-live-rating', ?, ?, ?, 5, 5, 5,
         'host_to_member', 'skill_manner_v2')`,
    )
    .run(demo.activityId, owner.email, demo.participantEmail);

  assert.equal(
    sqlite
      .prepare("SELECT COUNT(*) AS count FROM ratings WHERE rated_email = ?")
      .get(demo.participantEmail).count,
    3,
  );

  await resetIrDemoData(d1, owner);
  assert.equal(
    sqlite
      .prepare("SELECT COUNT(*) AS count FROM ratings WHERE rated_email = ?")
      .get(demo.participantEmail).count,
    2,
  );
  assert.equal(
    sqlite
      .prepare(
        `SELECT attendance_status FROM participants
         WHERE activity_id = ? AND user_email = ?`,
      )
      .get(demo.activityId, demo.participantEmail).attendance_status,
    "pending",
  );
});

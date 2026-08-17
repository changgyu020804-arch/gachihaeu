import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  joinActivityWaitlist,
  leaveActivityAndPromoteNext,
} from "../server/repositories/activity-membership.repository.ts";

class TestD1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new TestD1Statement(this.database, this.sql, values);
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.values) ?? null;
  }
}

class TestD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new TestD1Statement(this.database, sql);
  }
}

function createMembershipDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE activities (
      id TEXT PRIMARY KEY,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE participants (
      activity_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      PRIMARY KEY (activity_id, user_email)
    );
    CREATE TABLE waitlist (
      activity_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      position INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      queued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (activity_id, user_email)
    );
  `);
  return { sqlite, db: new TestD1Database(sqlite) };
}

test("a non-participant cannot promote a waiting member", async () => {
  const { sqlite, db } = createMembershipDatabase();
  sqlite.exec(`
    INSERT INTO activities VALUES ('a1', 2, 'open');
    INSERT INTO participants VALUES ('a1', 'host@uos.ac.kr', 'host');
    INSERT INTO participants VALUES ('a1', 'member@uos.ac.kr', 'member');
    INSERT INTO waitlist VALUES ('a1', 'waiting@uos.ac.kr', 'waiting', 1, 'waiting', CURRENT_TIMESTAMP);
  `);

  const result = await leaveActivityAndPromoteNext(
    db,
    "a1",
    "outsider@uos.ac.kr",
  );

  assert.deepEqual(result, { left: false, promoted: null });
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM participants").get().count,
    2,
  );
  assert.equal(
    sqlite
      .prepare("SELECT status FROM waitlist WHERE user_email = ?")
      .get("waiting@uos.ac.kr").status,
    "waiting",
  );
});

test("a real cancellation promotes exactly one member without exceeding capacity", async () => {
  const { sqlite, db } = createMembershipDatabase();
  sqlite.exec(`
    INSERT INTO activities VALUES ('a1', 2, 'open');
    INSERT INTO participants VALUES ('a1', 'host@uos.ac.kr', 'host');
    INSERT INTO participants VALUES ('a1', 'member@uos.ac.kr', 'member');
    INSERT INTO waitlist VALUES ('a1', 'first@uos.ac.kr', 'first', 1, 'waiting', CURRENT_TIMESTAMP);
    INSERT INTO waitlist VALUES ('a1', 'second@uos.ac.kr', 'second', 2, 'waiting', CURRENT_TIMESTAMP);
  `);

  const result = await leaveActivityAndPromoteNext(
    db,
    "a1",
    "member@uos.ac.kr",
  );

  assert.equal(result.left, true);
  assert.equal(result.promoted?.userEmail, "first@uos.ac.kr");
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM participants").get().count,
    2,
  );
  assert.equal(
    sqlite
      .prepare("SELECT status FROM waitlist WHERE user_email = ?")
      .get("first@uos.ac.kr").status,
    "promoted",
  );
  assert.equal(
    sqlite
      .prepare("SELECT status FROM waitlist WHERE user_email = ?")
      .get("second@uos.ac.kr").status,
    "waiting",
  );
});

test("a cancelled waitlist entry can join again with one queue position", async () => {
  const { sqlite, db } = createMembershipDatabase();
  sqlite.exec(`
    INSERT INTO activities VALUES ('a1', 1, 'open');
    INSERT INTO participants VALUES ('a1', 'host@uos.ac.kr', 'host');
    INSERT INTO waitlist VALUES ('a1', 'returning@uos.ac.kr', 'old', 1, 'cancelled', CURRENT_TIMESTAMP);
    INSERT INTO waitlist VALUES ('a1', 'other@uos.ac.kr', 'other', 2, 'waiting', CURRENT_TIMESTAMP);
  `);

  const first = await joinActivityWaitlist(db, {
    activityId: "a1",
    userEmail: "returning@uos.ac.kr",
    displayName: "returning",
  });
  const repeated = await joinActivityWaitlist(db, {
    activityId: "a1",
    userEmail: "returning@uos.ac.kr",
    displayName: "returning",
  });

  assert.deepEqual(first, { position: 3, created: true });
  assert.deepEqual(repeated, { position: 3, created: false });
  assert.deepEqual(
    { ...sqlite
      .prepare(
        "SELECT position, status FROM waitlist WHERE activity_id = ? AND user_email = ?",
      )
      .get("a1", "returning@uos.ac.kr") },
    { position: 3, status: "waiting" },
  );
});

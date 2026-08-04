type ColumnInfo = { name: string };

function hasColumn(columns: ColumnInfo[], name: string) {
  return columns.some((column) => column.name === name);
}

async function addMissingActivityColumns(db: D1Database) {
  const { results: columns } = await db
    .prepare("PRAGMA table_info(activities)")
    .all<ColumnInfo>();

  const additions = [
    ["facility_reserved", "INTEGER DEFAULT 0 NOT NULL"],
    ["notice", "TEXT DEFAULT '' NOT NULL"],
    ["notice_updated_at", "TEXT"],
    ["cancellation_deadline_minutes", "INTEGER DEFAULT 60 NOT NULL"],
    ["cancellation_reason", "TEXT DEFAULT '' NOT NULL"],
  ] as const;

  for (const [name, definition] of additions) {
    if (!hasColumn(columns, name)) {
      await db
        .prepare(`ALTER TABLE activities ADD COLUMN ${name} ${definition}`)
        .run();
    }
  }
}

async function addMissingParticipantColumns(db: D1Database) {
  const { results: columns } = await db
    .prepare("PRAGMA table_info(participants)")
    .all<ColumnInfo>();
  if (!hasColumn(columns, "attendance_status")) {
    await db
      .prepare(
        "ALTER TABLE participants ADD COLUMN attendance_status TEXT DEFAULT 'pending' NOT NULL",
      )
      .run();
  }
}

async function addMissingProfileColumns(db: D1Database) {
  const { results: columns } = await db
    .prepare("PRAGMA table_info(user_profiles)")
    .all<ColumnInfo>();
  const additions = [
    ["gender", "TEXT DEFAULT '' NOT NULL"],
    ["campus_role", "TEXT DEFAULT '' NOT NULL"],
    ["onboarding_completed", "INTEGER DEFAULT 0 NOT NULL"],
    ["nickname_normalized", "TEXT"],
  ] as const;

  for (const [name, definition] of additions) {
    if (!hasColumn(columns, name)) {
      await db
        .prepare(`ALTER TABLE user_profiles ADD COLUMN ${name} ${definition}`)
        .run();
    }
  }

  // Keep the oldest account's nickname as the canonical one. Any legacy
  // duplicates get a private placeholder and must choose a new nickname when
  // they next edit their profile.
  await db
    .prepare(
      `UPDATE user_profiles AS profile
       SET nickname_normalized = CASE
         WHEN trim(nickname) = '' THEN NULL
         WHEN rowid = (
           SELECT MIN(candidate.rowid)
           FROM user_profiles AS candidate
           WHERE lower(trim(candidate.nickname)) = lower(trim(profile.nickname))
         ) THEN lower(trim(nickname))
         ELSE '__legacy_duplicate__:' || rowid
       END
       WHERE nickname_normalized IS NULL`,
    )
    .run();

  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_nickname_normalized_idx ON user_profiles(nickname_normalized)",
    )
    .run();
}

async function addMissingRatingColumns(db: D1Database) {
  const { results: columns } = await db
    .prepare("PRAGMA table_info(ratings)")
    .all<ColumnInfo>();
  const additions = [
    ["rating_type", "TEXT DEFAULT 'legacy' NOT NULL"],
    ["comment_hidden", "INTEGER DEFAULT 0 NOT NULL"],
    ["reported_at", "TEXT"],
  ] as const;

  for (const [name, definition] of additions) {
    if (!hasColumn(columns, name)) {
      await db
        .prepare(`ALTER TABLE ratings ADD COLUMN ${name} ${definition}`)
        .run();
    }
  }
}

async function secureLegacyAuthCodes(db: D1Database) {
  const { results: columns } = await db
    .prepare("PRAGMA table_info(auth_codes)")
    .all<ColumnInfo>();
  const isSecure =
    hasColumn(columns, "code_hash") &&
    hasColumn(columns, "attempts") &&
    !hasColumn(columns, "code");

  if (isSecure) return;

  await db.prepare("DROP TABLE auth_codes").run();
  await db
    .prepare(
      `CREATE TABLE auth_codes (
        email TEXT PRIMARY KEY NOT NULL,
        code_hash TEXT NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    )
    .run();
}

export async function upgradeLegacySchema(db: D1Database) {
  await addMissingActivityColumns(db);
  await addMissingParticipantColumns(db);
  await addMissingProfileColumns(db);
  await addMissingRatingColumns(db);
  await secureLegacyAuthCodes(db);

  await db.batch([
    db.prepare(
      "CREATE INDEX IF NOT EXISTS participants_attendance_idx ON participants(activity_id, attendance_status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS ratings_type_idx ON ratings(rated_email, rating_type)",
    ),
    db.prepare(
      "DELETE FROM auth_codes WHERE datetime(expires_at) <= datetime('now')",
    ),
    db.prepare(
      "DELETE FROM security_rate_limits WHERE updated_at < datetime('now', '-2 days')",
    ),
    db.prepare(
      "DELETE FROM security_audit_logs WHERE created_at < datetime('now', '-90 days')",
    ),
  ]);

  await db
    .prepare(
      "UPDATE activities SET venue = '대운동장 잔디구장' WHERE venue = '축구장'",
    )
    .run();
}

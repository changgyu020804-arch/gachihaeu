export async function createCurrentSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY NOT NULL,
        creator_email TEXT NOT NULL,
        creator_name TEXT NOT NULL,
        sport TEXT NOT NULL,
        title TEXT NOT NULL,
        venue TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        capacity INTEGER NOT NULL,
        level TEXT NOT NULL,
        description TEXT DEFAULT '' NOT NULL,
        notice TEXT DEFAULT '' NOT NULL,
        notice_updated_at TEXT,
        status TEXT DEFAULT 'open' NOT NULL,
        facility_reserved INTEGER DEFAULT 0 NOT NULL,
        cancellation_deadline_minutes INTEGER DEFAULT 60 NOT NULL,
        cancellation_reason TEXT DEFAULT '' NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS participants (
        activity_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        attendance_status TEXT DEFAULT 'pending' NOT NULL,
        joined_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (activity_id, user_email),
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY NOT NULL,
        activity_id TEXT NOT NULL,
        reporter_email TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS activities_starts_at_idx ON activities(starts_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS activities_creator_idx ON activities(creator_email)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS activities_status_idx ON activities(status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS participants_user_idx ON participants(user_email)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS reports_activity_reporter_idx ON reports(activity_id, reporter_email)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS activity_comments (
        id TEXT PRIMARY KEY NOT NULL,
        activity_id TEXT NOT NULL,
        author_email TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT DEFAULT 'visible' NOT NULL,
        is_pinned INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS activity_comments_activity_created_idx ON activity_comments(activity_id, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS activity_comments_author_idx ON activity_comments(author_email)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS comment_reports (
        id TEXT PRIMARY KEY NOT NULL,
        comment_id TEXT NOT NULL,
        reporter_email TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (comment_id) REFERENCES activity_comments(id) ON DELETE CASCADE
      )`,
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS comment_reports_comment_reporter_idx ON comment_reports(comment_id, reporter_email)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS comment_reports_comment_idx ON comment_reports(comment_id)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS user_profiles (
        email TEXT PRIMARY KEY NOT NULL,
        nickname TEXT DEFAULT '' NOT NULL,
        nickname_normalized TEXT,
        gender TEXT DEFAULT '' NOT NULL,
        campus_role TEXT DEFAULT '' NOT NULL,
        requested_campus_role TEXT DEFAULT '' NOT NULL,
        role_verification_status TEXT DEFAULT 'not_required' NOT NULL,
        department TEXT DEFAULT '' NOT NULL,
        bio TEXT DEFAULT '' NOT NULL,
        preferred_sports TEXT DEFAULT '' NOT NULL,
        onboarding_completed INTEGER DEFAULT 0 NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS role_verification_requests (
        id TEXT PRIMARY KEY NOT NULL,
        user_email TEXT NOT NULL,
        requested_role TEXT NOT NULL,
        document_type TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        object_key TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        reviewer_email TEXT,
        review_note TEXT DEFAULT '' NOT NULL,
        reviewed_at TEXT,
        evidence_delete_after TEXT,
        evidence_deleted_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS role_verification_user_created_idx ON role_verification_requests(user_email, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS role_verification_status_created_idx ON role_verification_requests(status, created_at)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS ratings (
        id TEXT PRIMARY KEY NOT NULL,
        activity_id TEXT NOT NULL,
        rater_email TEXT NOT NULL,
        rated_email TEXT NOT NULL,
        trust_score INTEGER NOT NULL,
        skill_score INTEGER NOT NULL,
        manner_score INTEGER NOT NULL,
        rating_type TEXT DEFAULT 'legacy' NOT NULL,
        comment TEXT DEFAULT '' NOT NULL,
        comment_hidden INTEGER DEFAULT 0 NOT NULL,
        reported_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
      )`,
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS ratings_unique_idx ON ratings(activity_id, rater_email, rated_email)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS ratings_rated_idx ON ratings(rated_email)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS ratings_activity_idx ON ratings(activity_id)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS auth_codes (
        email TEXT PRIMARY KEY NOT NULL,
        code_hash TEXT NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS security_rate_limits (
        action TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        window_bucket INTEGER NOT NULL,
        request_count INTEGER DEFAULT 1 NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (action, key_hash, window_bucket)
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS security_audit_logs (
        id TEXT PRIMARY KEY NOT NULL,
        event_type TEXT NOT NULL,
        subject_hash TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        detail TEXT DEFAULT '' NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS security_rate_limits_updated_idx ON security_rate_limits(updated_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS security_audit_logs_created_idx ON security_audit_logs(created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS security_audit_logs_event_idx ON security_audit_logs(event_type, created_at)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS waitlist (
        activity_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        position INTEGER NOT NULL,
        status TEXT DEFAULT 'waiting' NOT NULL,
        queued_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (activity_id, user_email),
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS waitlist_activity_position_idx ON waitlist(activity_id, position)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY NOT NULL,
        user_email TEXT NOT NULL,
        activity_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        dedupe_key TEXT NOT NULL,
        read_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_idx ON notifications(user_email, dedupe_key)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_email, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_email, read_at)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS user_reports (
        id TEXT PRIMARY KEY NOT NULL,
        reporter_email TEXT NOT NULL,
        reported_email TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS user_reports_pair_idx ON user_reports(reporter_email, reported_email)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS user_reports_reported_idx ON user_reports(reported_email)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS user_blocks (
        blocker_email TEXT NOT NULL,
        blocked_email TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (blocker_email, blocked_email)
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks(blocked_email)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS attendance_codes (
        activity_id TEXT PRIMARY KEY NOT NULL,
        code_hash TEXT NOT NULL,
        valid_from TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS attendance_codes_expiry_idx ON attendance_codes(expires_at)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS moderation_actions (
        id TEXT PRIMARY KEY NOT NULL,
        report_type TEXT NOT NULL,
        report_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_email TEXT NOT NULL,
        moderator_email TEXT NOT NULL,
        note TEXT DEFAULT '' NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS moderation_actions_report_idx ON moderation_actions(report_type, report_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS moderation_actions_target_idx ON moderation_actions(target_email, created_at)",
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS user_sanctions (
        id TEXT PRIMARY KEY NOT NULL,
        user_email TEXT NOT NULL,
        kind TEXT NOT NULL,
        reason TEXT NOT NULL,
        expires_at TEXT,
        created_by TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS user_sanctions_active_idx ON user_sanctions(user_email, revoked_at, expires_at)",
    ),
  ]);
}

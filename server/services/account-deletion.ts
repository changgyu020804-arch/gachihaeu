const USER_RATE_LIMIT_ACTIONS = [
  "activity-cancel",
  "activity-comment-create",
  "activity-comment-delete",
  "activity-comment-pin",
  "activity-comment-report",
  "activity-create",
  "activity-join",
  "activity-leave",
  "activity-notice",
  "activity-report",
  "attendance-update",
  "attendance-code-generate",
  "attendance-check-in",
  "notifications-read",
  "profile-update",
  "push-token-register",
  "role-verification-submit",
  "role-verification-review",
  "rating-comment-report",
  "rating-create",
  "user-block",
  "user-report",
  "user-unblock",
  "waitlist-join",
  "waitlist-leave",
] as const;

const EMAIL_RATE_LIMIT_ACTIONS = [
  "auth-code-send-email",
  "auth-code-verify-email",
] as const;

export function getAccountRateLimitIdentifiers(email: string) {
  return [
    ...USER_RATE_LIMIT_ACTIONS.map((action) => ({
      action,
      identifier: `user:${email}`,
    })),
    ...EMAIL_RATE_LIMIT_ACTIONS.map((action) => ({
      action,
      identifier: `email:${email}`,
    })),
  ];
}

export async function deleteAccountData(
  db: D1Database,
  email: string,
  securitySubjectHash: string,
  rateLimitKeyHashes: string[],
) {
  const sanction = await db
    .prepare(
      `SELECT kind, expires_at
       FROM user_sanctions
       WHERE user_email = ?
         AND revoked_at IS NULL
         AND kind IN ('suspended', 'banned')
         AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(email)
    .first<{ kind: string; expires_at: string | null }>();

  const statements = [
    db
      .prepare(
        `INSERT INTO account_security_state (
           subject_hash, session_version, sanction_kind,
           sanction_expires_at, updated_at
         ) VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(subject_hash) DO UPDATE SET
           session_version = account_security_state.session_version + 1,
           sanction_kind = excluded.sanction_kind,
           sanction_expires_at = excluded.sanction_expires_at,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        securitySubjectHash,
        sanction?.kind ?? null,
        sanction?.expires_at ?? null,
      ),
    db.prepare(`DELETE FROM push_tokens WHERE user_email = ?`).bind(email),
    db.prepare(`DELETE FROM user_sanctions WHERE user_email = ?`).bind(email),
    db.prepare(`DELETE FROM moderation_actions WHERE target_email = ? OR moderator_email = ?`).bind(email, email),
    db.prepare(
      `DELETE FROM attendance_codes
       WHERE generated_by = ? OR activity_id IN (
         SELECT id FROM activities WHERE creator_email = ?
       )`,
    ).bind(email, email),
    db
      .prepare(
        `DELETE FROM notifications
         WHERE user_email = ?
            OR instr(dedupe_key, ?) > 0
            OR activity_id IN (
              SELECT id FROM activities WHERE creator_email = ?
            )`,
      )
      .bind(email, email, email),
    db
      .prepare(
        `DELETE FROM reports
         WHERE reporter_email = ?
            OR activity_id IN (
              SELECT id FROM activities WHERE creator_email = ?
            )`,
      )
      .bind(email, email),
    db
      .prepare(
        `DELETE FROM comment_reports
         WHERE reporter_email = ?
            OR comment_id IN (
              SELECT c.id
              FROM activity_comments c
              INNER JOIN activities a ON a.id = c.activity_id
              WHERE c.author_email = ? OR a.creator_email = ?
            )`,
      )
      .bind(email, email, email),
    db
      .prepare(
        `DELETE FROM activity_comments
         WHERE author_email = ?
            OR activity_id IN (
              SELECT id FROM activities WHERE creator_email = ?
            )`,
      )
      .bind(email, email),
    db
      .prepare(
        `DELETE FROM ratings
         WHERE rater_email = ?
            OR rated_email = ?
            OR activity_id IN (
              SELECT id FROM activities WHERE creator_email = ?
            )`,
      )
      .bind(email, email, email),
    db
      .prepare(
        `DELETE FROM participants
         WHERE user_email = ?
            OR activity_id IN (
              SELECT id FROM activities WHERE creator_email = ?
            )`,
      )
      .bind(email, email),
    db
      .prepare(
        `DELETE FROM waitlist
         WHERE user_email = ?
            OR activity_id IN (
              SELECT id FROM activities WHERE creator_email = ?
            )`,
      )
      .bind(email, email),
    db
      .prepare(
        `DELETE FROM user_reports
         WHERE reporter_email = ? OR reported_email = ?`,
      )
      .bind(email, email),
    db
      .prepare(
        `DELETE FROM user_blocks
         WHERE blocker_email = ? OR blocked_email = ?`,
      )
      .bind(email, email),
    db.prepare(`DELETE FROM auth_codes WHERE email = ?`).bind(email),
    db
      .prepare(`DELETE FROM role_verification_requests WHERE user_email = ?`)
      .bind(email),
    db.prepare(`DELETE FROM user_profiles WHERE email = ?`).bind(email),
    db.prepare(`DELETE FROM activities WHERE creator_email = ?`).bind(email),
    db
      .prepare(`DELETE FROM security_audit_logs WHERE subject_hash = ?`)
      .bind(securitySubjectHash),
  ];

  if (rateLimitKeyHashes.length > 0) {
    const placeholders = rateLimitKeyHashes.map(() => "?").join(", ");
    statements.push(
      db
        .prepare(
          `DELETE FROM security_rate_limits
           WHERE key_hash IN (${placeholders})`,
        )
        .bind(...rateLimitKeyHashes),
    );
  }

  await db.batch(statements);
}

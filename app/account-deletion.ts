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
  const statements = [
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

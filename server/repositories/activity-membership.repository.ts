export type PromotedWaitlistMember = {
  userEmail: string;
  displayName: string;
};

export async function leaveActivityAndPromoteNext(
  db: D1Database,
  activityId: string,
  userEmail: string,
) {
  const deleted = await db
    .prepare(
      `DELETE FROM participants
       WHERE activity_id = ? AND user_email = ?`,
    )
    .bind(activityId, userEmail)
    .run();

  if (Number(deleted.meta.changes ?? 0) !== 1) {
    return { left: false, promoted: null };
  }

  // Two users can leave almost simultaneously. Re-read the first waiting
  // member and let the capacity-checked INSERT decide who actually advances.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const next = await db
      .prepare(
        `SELECT user_email, display_name
         FROM waitlist
         WHERE activity_id = ? AND status = 'waiting'
         ORDER BY position ASC, queued_at ASC
         LIMIT 1`,
      )
      .bind(activityId)
      .first<{ user_email: string; display_name: string }>();

    if (!next) return { left: true, promoted: null };

    const inserted = await db
      .prepare(
        `INSERT OR IGNORE INTO participants (
           activity_id, user_email, display_name
         )
         SELECT ?, ?, ?
         WHERE (
           SELECT COUNT(*) FROM participants WHERE activity_id = ?
         ) < (
           SELECT capacity
           FROM activities
           WHERE id = ? AND status = 'open'
         )`,
      )
      .bind(
        activityId,
        next.user_email,
        next.display_name,
        activityId,
        activityId,
      )
      .run();

    if (Number(inserted.meta.changes ?? 0) === 1) {
      await db
        .prepare(
          `UPDATE waitlist
           SET status = 'promoted'
           WHERE activity_id = ? AND user_email = ? AND status = 'waiting'`,
        )
        .bind(activityId, next.user_email)
        .run();
      return {
        left: true,
        promoted: {
          userEmail: next.user_email,
          displayName: next.display_name,
        } satisfies PromotedWaitlistMember,
      };
    }

    // Recover a stale waiting row that already exists in participants, then
    // continue to the next person. If the activity is full, stop immediately.
    const recovered = await db
      .prepare(
        `UPDATE waitlist
         SET status = 'promoted'
         WHERE activity_id = ?
           AND user_email = ?
           AND status = 'waiting'
           AND EXISTS (
             SELECT 1 FROM participants
             WHERE activity_id = ? AND user_email = ?
           )`,
      )
      .bind(activityId, next.user_email, activityId, next.user_email)
      .run();

    if (Number(recovered.meta.changes ?? 0) === 0) {
      return { left: true, promoted: null };
    }
  }

  return { left: true, promoted: null };
}

export async function joinActivityWaitlist(
  db: D1Database,
  input: {
    activityId: string;
    userEmail: string;
    displayName: string;
  },
) {
  const queued = await db
    .prepare(
      `INSERT INTO waitlist (
         activity_id, user_email, display_name,
         position, status, queued_at
       )
       SELECT
         ?, ?, ?,
         COALESCE((
           SELECT MAX(position)
           FROM waitlist
           WHERE activity_id = ? AND status = 'waiting'
         ), 0) + 1,
         'waiting', CURRENT_TIMESTAMP
       WHERE NOT EXISTS (
         SELECT 1 FROM participants
         WHERE activity_id = ? AND user_email = ?
       )
         AND (
           SELECT COUNT(*) FROM participants WHERE activity_id = ?
         ) >= (
           SELECT capacity
           FROM activities
           WHERE id = ? AND status = 'open'
         )
       ON CONFLICT(activity_id, user_email) DO UPDATE SET
         display_name = excluded.display_name,
         position = excluded.position,
         status = 'waiting',
         queued_at = CURRENT_TIMESTAMP
       WHERE waitlist.status <> 'waiting'
       RETURNING position`,
    )
    .bind(
      input.activityId,
      input.userEmail,
      input.displayName,
      input.activityId,
      input.activityId,
      input.userEmail,
      input.activityId,
      input.activityId,
    )
    .first<{ position: number }>();

  if (queued) return { position: queued.position, created: true };

  const existing = await db
    .prepare(
      `SELECT position
       FROM waitlist
       WHERE activity_id = ? AND user_email = ? AND status = 'waiting'`,
    )
    .bind(input.activityId, input.userEmail)
    .first<{ position: number }>();

  return existing
    ? { position: existing.position, created: false }
    : null;
}

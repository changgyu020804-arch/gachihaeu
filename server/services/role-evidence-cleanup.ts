export async function cleanupExpiredRoleEvidence(
  db: D1Database,
  bucket: R2Bucket,
) {
  const expired = await db
    .prepare(
      `SELECT id, object_key
       FROM role_verification_requests
       WHERE evidence_deleted_at IS NULL
         AND evidence_delete_after IS NOT NULL
         AND datetime(evidence_delete_after) <= datetime('now')
       LIMIT 50`,
    )
    .all<{ id: string; object_key: string }>();

  if (expired.results.length === 0) return 0;

  await bucket.delete(expired.results.map((item) => item.object_key));
  await db.batch(
    expired.results.map((item) =>
      db
        .prepare(
          `UPDATE role_verification_requests
           SET evidence_deleted_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(item.id),
    ),
  );
  return expired.results.length;
}

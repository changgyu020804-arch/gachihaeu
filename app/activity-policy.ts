export function getUserDisplayName(user: {
  fullName: string | null;
  email: string;
}) {
  return user.fullName?.trim() || user.email.split("@")[0];
}

export async function hasBlockedRelationship(
  db: D1Database,
  firstEmail: string,
  secondEmail: string,
) {
  const relationship = await db
    .prepare(
      `SELECT 1
       FROM user_blocks
       WHERE
         (blocker_email = ? AND blocked_email = ?)
         OR
         (blocker_email = ? AND blocked_email = ?)
       LIMIT 1`,
    )
    .bind(firstEmail, secondEmail, secondEmail, firstEmail)
    .first();

  return Boolean(relationship);
}

export function cancellationDeadlineLabel(minutes: number) {
  if (minutes === 0) return "모임 시작";
  if (minutes === 1440) return "모임 하루 전";
  return `모임 ${minutes / 60}시간 전`;
}

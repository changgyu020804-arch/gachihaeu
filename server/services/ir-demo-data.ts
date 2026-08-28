const DEMO_ACTIVITY_ID = "ir-demo-rating-reveal-v1";
const DEMO_HISTORY_ACTIVITY_IDS = [
  "ir-demo-running-history-1",
  "ir-demo-running-history-2",
] as const;

const DEMO_MEMBER = {
  email: "ir-demo-minjun@gachihaeu.internal",
  nickname: "민준러너",
  department: "스포츠과학과",
};

const DEMO_RATERS = [
  {
    email: "ir-demo-seoyeon@gachihaeu.internal",
    nickname: "서연페이서",
    department: "경영학과",
    skillScore: 4,
    mannerScore: 5,
    comment: "페이스를 잘 맞춰주고 끝까지 함께 달렸어요.",
  },
  {
    email: "ir-demo-jihoon@gachihaeu.internal",
    nickname: "지훈러너",
    department: "컴퓨터과학부",
    skillScore: 5,
    mannerScore: 4,
    comment: "시간 약속을 잘 지키고 팀원을 배려해 줬어요.",
  },
] as const;

function hoursBefore(now: number, hours: number) {
  return new Date(now - hours * 60 * 60_000).toISOString();
}

function daysBefore(now: number, days: number) {
  return new Date(now - days * 24 * 60 * 60_000).toISOString();
}

function insertDemoProfile(
  db: D1Database,
  profile: { email: string; nickname: string; department: string },
) {
  return db
    .prepare(
      `INSERT INTO user_profiles (
         email, nickname, nickname_normalized, gender, campus_role,
         requested_campus_role, role_verification_status, department, bio,
         preferred_sports, onboarding_completed, updated_at
       ) VALUES (?, ?, ?, '남성', '학생', '학생', 'not_required', ?, ?, '러닝', 1, datetime('now'))
       ON CONFLICT(email) DO UPDATE SET
         nickname = excluded.nickname,
         nickname_normalized = excluded.nickname_normalized,
         gender = excluded.gender,
         campus_role = excluded.campus_role,
         requested_campus_role = excluded.requested_campus_role,
         role_verification_status = excluded.role_verification_status,
         department = excluded.department,
         bio = excluded.bio,
         preferred_sports = excluded.preferred_sports,
         onboarding_completed = 1,
         updated_at = excluded.updated_at`,
    )
    .bind(
      profile.email,
      profile.nickname,
      profile.nickname.toLocaleLowerCase("ko-KR"),
      profile.department,
      "IR 발표를 위해 구성한 시연용 가상 프로필입니다.",
    );
}

export type IrDemoData = {
  activityId: string;
  participantEmail: string;
  participantNickname: string;
  existingRatingCount: number;
};

export async function resetIrDemoData(
  db: D1Database,
  owner: { email: string; displayName: string },
): Promise<IrDemoData> {
  const now = Date.now();
  const allActivityIds = [DEMO_ACTIVITY_ID, ...DEMO_HISTORY_ACTIVITY_IDS];
  const placeholders = allActivityIds.map(() => "?").join(", ");

  await db.batch([
    db
      .prepare(`DELETE FROM notifications WHERE activity_id IN (${placeholders})`)
      .bind(...allActivityIds),
    db
      .prepare(
        `DELETE FROM ratings
         WHERE rated_email = ?
            OR activity_id IN (${placeholders})`,
      )
      .bind(DEMO_MEMBER.email, ...allActivityIds),
    db
      .prepare(`DELETE FROM participants WHERE activity_id IN (${placeholders})`)
      .bind(...allActivityIds),
    db
      .prepare(`DELETE FROM activities WHERE id IN (${placeholders})`)
      .bind(...allActivityIds),
    db
      .prepare(
        `DELETE FROM user_blocks
         WHERE blocker_email = ? OR blocked_email = ?`,
      )
      .bind(DEMO_MEMBER.email, DEMO_MEMBER.email),
    insertDemoProfile(db, DEMO_MEMBER),
    ...DEMO_RATERS.map((rater) => insertDemoProfile(db, rater)),
    db
      .prepare(
        `INSERT INTO activities (
           id, creator_email, creator_name, sport, title, venue, starts_at,
           duration_minutes, capacity, level, description, notice, status,
           facility_reserved, cancellation_deadline_minutes, created_at
         ) VALUES (?, ?, ?, '러닝', ?, '대운동장 러닝트랙', ?, 60, 4,
           '초보 환영', ?, ?, 'open', 0, 60, ?)`
      )
      .bind(
        DEMO_ACTIVITY_ID,
        owner.email,
        owner.displayName,
        "IR 시연 · 함께 달린 저녁 러닝",
        hoursBefore(now, 2),
        "발표에서 출석 확인과 세 번째 평가를 시연하는 모임입니다.",
        "시연용 가상 인물과 데이터가 포함되어 있어요.",
        hoursBefore(now, 3),
      ),
    db
      .prepare(
        `INSERT INTO participants (
           activity_id, user_email, display_name, attendance_status, joined_at
         ) VALUES (?, ?, ?, 'attended', ?)`
      )
      .bind(
        DEMO_ACTIVITY_ID,
        owner.email,
        owner.displayName,
        hoursBefore(now, 3),
      ),
    db
      .prepare(
        `INSERT INTO participants (
           activity_id, user_email, display_name, attendance_status, joined_at
         ) VALUES (?, ?, ?, 'pending', ?)`
      )
      .bind(
        DEMO_ACTIVITY_ID,
        DEMO_MEMBER.email,
        DEMO_MEMBER.nickname,
        hoursBefore(now, 2.5),
      ),
    ...DEMO_RATERS.flatMap((rater, index) => {
      const activityId = DEMO_HISTORY_ACTIVITY_IDS[index];
      const startsAt = daysBefore(now, 8 - index * 4);
      const createdAt = daysBefore(now, 9 - index * 4);
      return [
        db
          .prepare(
            `INSERT INTO activities (
               id, creator_email, creator_name, sport, title, venue, starts_at,
               duration_minutes, capacity, level, description, notice, status,
               facility_reserved, cancellation_deadline_minutes, created_at
             ) VALUES (?, ?, ?, '러닝', ?, '대운동장 러닝트랙', ?, 60, 4,
               '누구나', '', '', 'open', 0, 60, ?)`
          )
          .bind(
            activityId,
            rater.email,
            rater.nickname,
            `시연 이력 ${index + 1} · 러닝 메이트`,
            startsAt,
            createdAt,
          ),
        db
          .prepare(
            `INSERT INTO participants (
               activity_id, user_email, display_name, attendance_status, joined_at
             ) VALUES (?, ?, ?, 'attended', ?)`
          )
          .bind(activityId, rater.email, rater.nickname, createdAt),
        db
          .prepare(
            `INSERT INTO participants (
               activity_id, user_email, display_name, attendance_status, joined_at
             ) VALUES (?, ?, ?, 'attended', ?)`
          )
          .bind(activityId, DEMO_MEMBER.email, DEMO_MEMBER.nickname, createdAt),
        db
          .prepare(
            `INSERT INTO ratings (
               id, activity_id, rater_email, rated_email, trust_score,
               skill_score, manner_score, rating_type, evaluation_version,
               comment, comment_hidden, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, 'host_to_member',
               'skill_manner_v2', ?, 0, ?)`
          )
          .bind(
            `ir-demo-rating-${index + 1}`,
            activityId,
            rater.email,
            DEMO_MEMBER.email,
            rater.mannerScore,
            rater.skillScore,
            rater.mannerScore,
            rater.comment,
            startsAt,
          ),
      ];
    }),
  ]);

  return {
    activityId: DEMO_ACTIVITY_ID,
    participantEmail: DEMO_MEMBER.email,
    participantNickname: DEMO_MEMBER.nickname,
    existingRatingCount: DEMO_RATERS.length,
  };
}

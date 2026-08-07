const REVIEW_DOMAIN = "@review.gachihaeu.com";

export function isReviewDataEmail(email: string) {
  return email.trim().toLowerCase().endsWith(REVIEW_DOMAIN);
}

function futureIso(days: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export async function seedReviewData(db: D1Database, reviewerEmail: string) {
  const demoUsers = [
    { email: reviewerEmail, nickname: "AppReviewer", department: "기타" },
    { email: "demo-runner@review.gachihaeu.com", nickname: "달리는사과", department: "경영학과" },
    { email: "demo-basketball@review.gachihaeu.com", nickname: "파란농구공", department: "컴퓨터과학부" },
    { email: "demo-soccer@review.gachihaeu.com", nickname: "잔디메이트", department: "스포츠과학과" },
  ];

  const profileStatements = demoUsers.map((item) =>
    db
      .prepare(
        `INSERT INTO user_profiles (
           email, nickname, nickname_normalized, gender, campus_role, department,
           bio, preferred_sports, onboarding_completed, updated_at
         ) VALUES (?, ?, ?, '남성', '학생', ?, 'App Review 전용 데모 프로필입니다.',
                   '러닝,농구,축구', 1, CURRENT_TIMESTAMP)
         ON CONFLICT(email) DO UPDATE SET
           nickname = excluded.nickname,
           nickname_normalized = excluded.nickname_normalized,
           campus_role = '학생',
           department = excluded.department,
           onboarding_completed = 1,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(item.email, item.nickname, item.nickname.toLowerCase(), item.department),
  );

  const activities = [
    {
      id: "review-demo-running",
      creator: demoUsers[1],
      sport: "러닝",
      title: "대운동장 저녁 러닝",
      venue: "대운동장 러닝트랙",
      startsAt: futureIso(1, 18, 30),
      duration: 60,
      capacity: 8,
      level: "초보 환영",
      description: "App Review 전용 가상 모임입니다. 가볍게 5km를 함께 달려요.",
    },
    {
      id: "review-demo-basketball",
      creator: { email: reviewerEmail, nickname: "AppReviewer", department: "기타" },
      sport: "농구",
      title: "점심 농구 한 게임",
      venue: "실외농구장",
      startsAt: futureIso(2, 12, 30),
      duration: 90,
      capacity: 10,
      level: "누구나",
      description: "App Review 전용 가상 모임입니다. 팀을 나눠 안전하게 진행해요.",
    },
    {
      id: "review-demo-soccer",
      creator: demoUsers[3],
      sport: "축구",
      title: "주말 미니 축구",
      venue: "대운동장 잔디구장",
      startsAt: futureIso(4, 15),
      duration: 120,
      capacity: 12,
      level: "누구나",
      description: "App Review 전용 가상 모임입니다. 운동화와 물만 준비해 주세요.",
    },
  ];

  const activityStatements = activities.map((activity) =>
    db
      .prepare(
        `INSERT INTO activities (
           id, creator_email, creator_name, sport, title, venue, starts_at,
           duration_minutes, capacity, level, description, status,
           facility_reserved, cancellation_deadline_minutes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 1, 60)
         ON CONFLICT(id) DO UPDATE SET
           creator_email = excluded.creator_email,
           creator_name = excluded.creator_name,
           sport = excluded.sport,
           title = excluded.title,
           venue = excluded.venue,
           starts_at = excluded.starts_at,
           duration_minutes = excluded.duration_minutes,
           capacity = excluded.capacity,
           level = excluded.level,
           description = excluded.description,
           status = 'open'`,
      )
      .bind(
        activity.id,
        activity.creator.email,
        activity.creator.nickname,
        activity.sport,
        activity.title,
        activity.venue,
        activity.startsAt,
        activity.duration,
        activity.capacity,
        activity.level,
        activity.description,
      ),
  );

  await db.batch([...profileStatements, ...activityStatements]);

  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO participants (activity_id, user_email, display_name)
       VALUES ('review-demo-running', ?, 'AppReviewer')`,
    ).bind(reviewerEmail),
    db.prepare(
      `INSERT OR IGNORE INTO participants (activity_id, user_email, display_name)
       VALUES ('review-demo-running', 'demo-runner@review.gachihaeu.com', '달리는사과')`,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO participants (activity_id, user_email, display_name)
       VALUES ('review-demo-basketball', ?, 'AppReviewer')`,
    ).bind(reviewerEmail),
    db.prepare(
      `INSERT OR IGNORE INTO participants (activity_id, user_email, display_name)
       VALUES ('review-demo-basketball', 'demo-basketball@review.gachihaeu.com', '파란농구공')`,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO participants (activity_id, user_email, display_name)
       VALUES ('review-demo-soccer', 'demo-soccer@review.gachihaeu.com', '잔디메이트')`,
    ),
  ]);
}

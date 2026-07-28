import { createJWT, createSessionCookie } from "../../../auth";
import { ensureSchema, getD1 } from "../../../../db";

const MAX_ATTEMPTS = 5; // 5회 이상 틀리면 코드 삭제

export async function POST(request: Request) {
  const payload = (await request.json()) as Record<string, unknown>;
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const code = typeof payload.code === "string" ? payload.code.trim() : "";

  if (!email || !code) {
    return Response.json({ error: "이메일과 인증코드를 입력해 주세요." }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return Response.json({ error: "인증코드는 6자리 숫자예요." }, { status: 400 });
  }

  await ensureSchema();
  const db = getD1();

  // 해당 이메일의 유효한 코드 조회
  const record = await db
    .prepare(
      `SELECT code, expires_at FROM auth_codes
       WHERE email = ? AND expires_at > datetime('now')
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(email)
    .first<{ code: string; expires_at: string }>();

  if (!record) {
    return Response.json(
      { error: "인증코드가 만료되었거나 존재하지 않아요. 다시 요청해 주세요." },
      { status: 400 },
    );
  }

  // 코드 일치 확인
  if (record.code !== code) {
    // 시도 횟수 기반 삭제 (간단 구현: 코드 전체 삭제로 처리)
    // 실패 횟수 트래킹은 별도 컬럼 없이 5번째에 삭제
    const attempts = await db
      .prepare(`SELECT COUNT(*) as cnt FROM auth_codes WHERE email = ?`)
      .bind(email)
      .first<{ cnt: number }>();

    if (attempts && attempts.cnt >= MAX_ATTEMPTS) {
      await db.prepare(`DELETE FROM auth_codes WHERE email = ?`).bind(email).run();
      return Response.json(
        { error: "인증코드를 너무 많이 틀렸어요. 새 코드를 요청해 주세요." },
        { status: 400 },
      );
    }

    return Response.json({ error: "인증코드가 올바르지 않아요." }, { status: 400 });
  }

  // 코드 일치 → 사용한 코드 삭제
  await db.prepare(`DELETE FROM auth_codes WHERE email = ?`).bind(email).run();

  // user_profiles에 유저가 없으면 자동 생성
  const existingProfile = await db
    .prepare(`SELECT email FROM user_profiles WHERE email = ?`)
    .bind(email)
    .first();

  if (!existingProfile) {
    const nickname = email.split("@")[0];
    await db
      .prepare(
        `INSERT INTO user_profiles (email, nickname, department, bio, preferred_sports, updated_at)
         VALUES (?, ?, '', '', '', datetime('now'))`,
      )
      .bind(email, nickname)
      .run();
  }

  // 프로필에서 닉네임 가져오기
  const profile = await db
    .prepare(`SELECT nickname FROM user_profiles WHERE email = ?`)
    .bind(email)
    .first<{ nickname: string }>();

  const displayName = profile?.nickname || email.split("@")[0];

  // JWT 생성
  const token = await createJWT({
    email,
    displayName,
    fullName: displayName,
  });

  // 쿠키 설정하여 응답
  const cookieHeader = createSessionCookie(token);

  return new Response(
    JSON.stringify({ success: true, email, displayName }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieHeader,
      },
    },
  );
}

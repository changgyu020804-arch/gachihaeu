import { generateAuthCode, isValidUosEmail } from "../../../auth";
import { ensureSchema, getD1 } from "../../../../db";

const RESEND_API_KEY = "REMOVED_HISTORICAL_SECRET";
const FROM_EMAIL = "같이해U <onboarding@resend.dev>";
const CODE_EXPIRY_MINUTES = 5;
const RATE_LIMIT_SECONDS = 60; // 같은 이메일로 60초 내 재전송 불가

// 테스트용 어드민 계정 (코드: 000000으로 고정)
const ADMIN_EMAIL = "admin@uos.ac.kr";

export async function POST(request: Request) {
  const payload = (await request.json()) as Record<string, unknown>;
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";

  if (!email) {
    return Response.json({ error: "이메일을 입력해 주세요." }, { status: 400 });
  }

  // 어드민 계정은 이메일 발송 없이 바로 통과
  if (email === ADMIN_EMAIL) {
    await ensureSchema();
    const db = getD1();
    await db.prepare(`DELETE FROM auth_codes WHERE email = ?`).bind(email).run();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60_000).toISOString();
    await db
      .prepare(`INSERT INTO auth_codes (email, code, expires_at) VALUES (?, ?, ?)`)
      .bind(email, "000000", expiresAt)
      .run();
    return Response.json({ sent: true, expiresInMinutes: CODE_EXPIRY_MINUTES });
  }

  if (!isValidUosEmail(email)) {
    return Response.json(
      { error: "서울시립대 이메일(@uos.ac.kr)만 사용할 수 있어요." },
      { status: 400 },
    );
  }

  await ensureSchema();
  const db = getD1();

  // 레이트 리밋: 최근 60초 내 발송 여부 확인
  const recent = await db
    .prepare(
      `SELECT created_at FROM auth_codes
       WHERE email = ? AND created_at > datetime('now', ?)
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(email, `-${RATE_LIMIT_SECONDS} seconds`)
    .first<{ created_at: string }>();

  if (recent) {
    return Response.json(
      { error: "잠시 후 다시 시도해 주세요. (1분에 1회 제한)" },
      { status: 429 },
    );
  }

  // 기존 만료 안 된 코드 삭제
  await db
    .prepare(`DELETE FROM auth_codes WHERE email = ?`)
    .bind(email)
    .run();

  // 새 코드 생성
  const code = generateAuthCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60_000).toISOString();

  await db
    .prepare(
      `INSERT INTO auth_codes (email, code, expires_at) VALUES (?, ?, ?)`,
    )
    .bind(email, code, expiresAt)
    .run();

  // 이메일 발송 (Resend API)
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `[같이해U] 인증코드: ${code}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="color: #176bff; margin: 0 0 8px;">같이해U</h2>
            <p style="color: #697386; font-size: 14px; margin: 0 0 24px;">서울시립대 운동 메이트</p>
            <div style="background: #f5f7fa; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <p style="color: #697386; font-size: 14px; margin: 0 0 8px;">인증코드</p>
              <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827; margin: 0;">${code}</p>
            </div>
            <p style="font-size: 13px; color: #697386; margin: 0;">
              이 코드는 ${CODE_EXPIRY_MINUTES}분간 유효합니다.<br/>
              본인이 요청하지 않았다면 이 메일을 무시하세요.
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Resend API error:", errorBody);
      return Response.json(
        { error: "이메일 발송에 실패했어요. 잠시 후 다시 시도해 주세요." },
        { status: 500 },
      );
    }
  } catch (sendError) {
    console.error("Email send error:", sendError);
    return Response.json(
      { error: "이메일 발송에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  return Response.json({ sent: true, expiresInMinutes: CODE_EXPIRY_MINUTES });
}

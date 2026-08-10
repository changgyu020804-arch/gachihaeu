import { getSessionUser } from "@/server/auth/session";
import { cleanNickname, normalizeNickname } from "@/lib/validation/nickname";
import { getD1 } from "@/db/index";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const nickname = cleanNickname(new URL(request.url).searchParams.get("value"));
  if (!nickname) {
    return Response.json(
      { available: false, error: "닉네임을 입력해 주세요." },
      { status: 400 },
    );
  }
  const duplicate = await getD1()
    .prepare(
      `SELECT email
       FROM user_profiles
       WHERE nickname_normalized = ? AND email <> ?
       LIMIT 1`,
    )
    .bind(normalizeNickname(nickname), user.email)
    .first<{ email: string }>();

  return Response.json(
    { available: !duplicate },
    { headers: { "Cache-Control": "no-store" } },
  );
}

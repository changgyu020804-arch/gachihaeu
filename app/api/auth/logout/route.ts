import { deleteSessionCookies, getSessionUser } from "@/server/auth/session";
import { rejectCrossOriginMutation } from "@/server/security/request";
import { ensureSchema, getD1 } from "@/db/index";

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const user = await getSessionUser();
  if (user) {
    try {
      await ensureSchema();
      await getD1()
        .prepare(`UPDATE push_tokens SET enabled = 0 WHERE user_email = ?`)
        .bind(user.email)
        .run();
    } catch (error) {
      console.error("Could not disable push tokens during logout", error);
    }
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  for (const cookie of deleteSessionCookies()) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
}

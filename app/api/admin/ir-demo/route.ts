import { getD1 } from "@/db/index";
import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit, getClientIp, requestErrorResponse } from "@/server/security/request";
import { resetIrDemoData } from "@/server/services/ir-demo-data";
import { requireAdmin } from "@/server/services/role-verification";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const adminError = requireAdmin(user.email);
  if (adminError) return adminError;

  try {
    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "ir-demo-reset",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 10,
      windowSeconds: 60 * 60,
    });
    if (rateError) return rateError;

    const demo = await resetIrDemoData(db, {
      email: user.email,
      displayName: user.displayName,
    });
    return Response.json({ success: true, demo });
  } catch (error) {
    return requestErrorResponse(error);
  }
}

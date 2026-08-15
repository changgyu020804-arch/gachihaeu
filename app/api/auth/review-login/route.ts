import {
  constantTimeEqual,
  createJWT,
  createSessionCookie,
  deleteSessionCookies,
} from "@/server/auth/session";
import { getD1 } from "@/db/index";
import { getAppReviewConfig } from "@/server/config/runtime-env";
import { seedReviewData } from "@/server/services/review-account";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  rejectCrossOriginMutation,
  requestErrorResponse,
} from "@/server/security/request";

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  try {
    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "app-review-login",
      identifiers: [`ip:${getClientIp(request)}`],
      maximum: 10,
      windowSeconds: 15 * 60,
    });
    if (rateError) return rateError;

    const payload = await readJsonObject(request, 2_048);
    if (payload.termsAccepted !== true) {
      return Response.json(
        { error: "이용약관과 커뮤니티 운영정책에 동의해 주세요." },
        { status: 400 },
      );
    }
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const review = getAppReviewConfig();

    if (
      !constantTimeEqual(email, review.email) ||
      !constantTimeEqual(password, review.password)
    ) {
      return Response.json(
        { error: "심사용 계정 정보를 확인해 주세요." },
        { status: 401 },
      );
    }

    await seedReviewData(db, review.email);
    const displayName = "AppReviewer";
    const token = await createJWT({ email: review.email, displayName, fullName: displayName });
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    headers.append("Set-Cookie", createSessionCookie(token));
    headers.append("Set-Cookie", deleteSessionCookies()[1]);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          email: review.email,
          displayName,
          fullName: displayName,
          onboardingComplete: true,
        },
      }),
      { status: 200, headers },
    );
  } catch (error) {
    return requestErrorResponse(error);
  }
}

import { deleteSessionCookies, getSessionUser } from "../../auth";
import {
  getRateLimitKeyHash,
  getSecuritySubjectHash,
  readJsonObject,
  rejectCrossOriginMutation,
  requestErrorResponse,
} from "../../security";
import {
  deleteAccountData,
  getAccountRateLimitIdentifiers,
} from "../../account-deletion";
import { ensureSchema, getD1 } from "../../../db";

const DELETE_CONFIRMATION = "탈퇴";

export async function DELETE(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const payload = await readJsonObject(request, 1_024);
    if (payload.confirmation !== DELETE_CONFIRMATION) {
      return Response.json(
        { error: "계정 삭제를 확인하려면 ‘탈퇴’를 입력해 주세요." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const rateLimitIdentifiers = getAccountRateLimitIdentifiers(user.email);
    const [securitySubjectHash, rateLimitKeyHashes] = await Promise.all([
      getSecuritySubjectHash(user.email),
      Promise.all(
        rateLimitIdentifiers.map(({ action, identifier }) =>
          getRateLimitKeyHash(action, identifier),
        ),
      ),
    ]);

    await deleteAccountData(
      getD1(),
      user.email,
      securitySubjectHash,
      rateLimitKeyHashes,
    );

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
  } catch (error) {
    return requestErrorResponse(error);
  }
}

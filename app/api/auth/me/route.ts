import {
  createJWT,
  createSessionCookie,
  getSessionUser,
  shouldRefreshSession,
} from "../../../auth";
import { getViewerForSession } from "../../../viewer";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return Response.json(
      { user: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const viewer = await getViewerForSession(session);
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });

  if (shouldRefreshSession(session)) {
    const token = await createJWT({
      email: session.email,
      displayName: viewer.displayName,
      fullName: viewer.fullName,
      auth_time: session.authenticatedAt,
    });
    headers.append(
      "Set-Cookie",
      createSessionCookie(token, session.authenticatedAt),
    );
  }

  return new Response(JSON.stringify({ user: viewer }), {
    status: 200,
    headers,
  });
}

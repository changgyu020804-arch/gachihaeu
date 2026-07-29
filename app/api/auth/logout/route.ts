import { deleteSessionCookies } from "../../../auth";
import { rejectCrossOriginMutation } from "../../../security";

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

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

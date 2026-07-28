import { deleteSessionCookie } from "../../../auth";

export async function POST() {
  const cookieHeader = deleteSessionCookie();

  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieHeader,
      },
    },
  );
}

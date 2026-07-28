import { getSessionUser } from "../../../auth";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return Response.json({ user: null });
  }

  return Response.json({
    user: {
      email: user.email,
      displayName: user.displayName,
      fullName: user.fullName,
    },
  });
}

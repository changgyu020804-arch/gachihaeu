import { getSessionUser } from "@/server/auth/session";
import {
  getRoleEvidenceBucket,
  requireAdmin,
} from "@/server/services/role-verification";
import { getD1 } from "@/db/index";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const adminError = requireAdmin(user.email);
  if (adminError) return adminError;
  const { id } = await context.params;
  const row = await getD1()
    .prepare(
      `SELECT object_key, original_filename, content_type, evidence_deleted_at
       FROM role_verification_requests
       WHERE id = ?`,
    )
    .bind(id)
    .first<{
      object_key: string;
      original_filename: string;
      content_type: string;
      evidence_deleted_at: string | null;
    }>();

  if (!row || row.evidence_deleted_at) {
    return Response.json(
      { error: "증빙자료가 없거나 보관 기간이 끝났어요." },
      { status: 404 },
    );
  }

  const object = await getRoleEvidenceBucket().get(row.object_key);
  if (!object) {
    return Response.json({ error: "증빙자료를 찾지 못했어요." }, { status: 404 });
  }

  const filename = encodeURIComponent(row.original_filename);
  return new Response(object.body, {
    headers: {
      "Content-Type": row.content_type,
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

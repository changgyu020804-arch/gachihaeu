import { getSessionUser } from "../../../auth";
import {
  getRoleEvidenceBucket,
  requireAdmin,
} from "../../../role-verification";
import { cleanupExpiredRoleEvidence } from "../../../role-evidence-cleanup";
import { ensureSchema, getD1 } from "../../../../db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const adminError = requireAdmin(user.email);
  if (adminError) return adminError;

  await ensureSchema();
  const db = getD1();
  await cleanupExpiredRoleEvidence(db, getRoleEvidenceBucket());

  const rows = await db
    .prepare(
      `SELECT r.id, r.user_email, r.requested_role, r.document_type,
              r.original_filename, r.content_type, r.size_bytes, r.created_at,
              COALESCE(p.nickname, r.user_email) AS nickname,
              COALESCE(p.department, '') AS department
       FROM role_verification_requests r
       LEFT JOIN user_profiles p ON p.email = r.user_email
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC
       LIMIT 100`,
    )
    .all<{
      id: string;
      user_email: string;
      requested_role: string;
      document_type: string;
      original_filename: string;
      content_type: string;
      size_bytes: number;
      created_at: string;
      nickname: string;
      department: string;
    }>();

  return Response.json({
    requests: rows.results.map((row) => ({
      id: row.id,
      userEmail: row.user_email,
      nickname: row.nickname,
      department: row.department,
      requestedRole: row.requested_role,
      documentType: row.document_type,
      originalFilename: row.original_filename,
      contentType: row.content_type,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
    })),
  });
}

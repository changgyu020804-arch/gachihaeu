import { getSessionUser } from "@/server/auth/session";
import { ensureSchema, getD1 } from "@/db/index";
import {
  applyModerationAction,
  getModerationDashboard,
  ModerationStoreError,
} from "@/server/repositories/moderation.repository";
import {
  MODERATION_ACTIONS,
  REPORT_TYPES,
  type ModerationAction,
  type ReportType,
} from "@/lib/types/moderation";
import { requireAdmin } from "@/server/services/role-verification";
import { readJsonObject, requestErrorResponse } from "@/server/security/request";

async function requireModerator() {
  const user = await getSessionUser();
  if (!user) {
    return {
      error: Response.json({ error: "로그인이 필요해요." }, { status: 401 }),
    };
  }
  const adminError = requireAdmin(user.email);
  return adminError ? { error: adminError } : { user };
}

export async function GET() {
  const auth = await requireModerator();
  if ("error" in auth) return auth.error;

  await ensureSchema();
  return Response.json(await getModerationDashboard(getD1()));
}

export async function POST(request: Request) {
  const auth = await requireModerator();
  if ("error" in auth) return auth.error;

  try {
    const payload = await readJsonObject(request, 4_096);
    const reportTypeValue =
      typeof payload.reportType === "string" ? payload.reportType : "";
    const reportId =
      typeof payload.reportId === "string"
        ? payload.reportId.trim().slice(0, 100)
        : "";
    const actionValue =
      typeof payload.action === "string" ? payload.action : "";
    const note =
      typeof payload.note === "string" ? payload.note.trim().slice(0, 300) : "";

    if (
      !REPORT_TYPES.includes(reportTypeValue as ReportType) ||
      !MODERATION_ACTIONS.includes(actionValue as ModerationAction) ||
      !reportId
    ) {
      return Response.json(
        { error: "처리할 신고와 조치를 확인해 주세요." },
        { status: 400 },
      );
    }
    if (actionValue !== "dismiss" && note.length < 5) {
      return Response.json(
        { error: "조치 사유를 다섯 글자 이상 입력해 주세요." },
        { status: 400 },
      );
    }

    await ensureSchema();
    await applyModerationAction(getD1(), {
      reportType: reportTypeValue as ReportType,
      reportId,
      action: actionValue as ModerationAction,
      note,
      moderatorEmail: auth.user.email,
    });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ModerationStoreError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return requestErrorResponse(error);
  }
}

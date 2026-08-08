import { RequestValidationError } from "@/server/security/request";
import { VERIFICATION_DOCUMENT_TYPES } from "@/lib/types/role-verification";

export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_EVIDENCE_BYTES + 512 * 1024;

export type ValidatedRoleEvidence = {
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png" | "application/pdf";
  documentType: string;
  originalFilename: string;
  sizeBytes: number;
  sha256: string;
};

function safeFilename(value: string) {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .trim();
  return (cleaned || "증빙자료").slice(0, 120);
}

export function detectEvidenceContentType(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png" as const;
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg" as const;
  }
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf" as const;
  }
  return null;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function readRoleEvidenceUpload(
  request: Request,
): Promise<ValidatedRoleEvidence> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(contentLength) || contentLength > MAX_REQUEST_BYTES) {
    throw new RequestValidationError("파일은 5MB 이하로 올려 주세요.", 413);
  }

  const formData = await request.formData();
  const evidence = formData.get("evidence");
  const documentType = formData.get("documentType");
  const privacyAgreed = formData.get("privacyAgreed");

  if (!(evidence instanceof File) || evidence.size === 0) {
    throw new RequestValidationError("증빙자료를 선택해 주세요.", 400);
  }
  if (evidence.size > MAX_EVIDENCE_BYTES) {
    throw new RequestValidationError("파일은 5MB 이하로 올려 주세요.", 413);
  }
  if (
    typeof documentType !== "string" ||
    !VERIFICATION_DOCUMENT_TYPES.includes(documentType as never)
  ) {
    throw new RequestValidationError("증빙자료 종류를 선택해 주세요.", 400);
  }
  if (privacyAgreed !== "true") {
    throw new RequestValidationError("개인정보 처리 안내에 동의해 주세요.", 400);
  }

  const bytes = new Uint8Array(await evidence.arrayBuffer());
  const contentType = detectEvidenceContentType(bytes);
  if (!contentType) {
    throw new RequestValidationError(
      "JPG, PNG 또는 PDF 파일만 올릴 수 있어요.",
      415,
    );
  }

  const sha256 = bytesToHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  );

  return {
    bytes,
    contentType,
    documentType,
    originalFilename: safeFilename(evidence.name),
    sizeBytes: evidence.size,
    sha256,
  };
}

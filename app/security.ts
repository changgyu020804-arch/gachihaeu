import { getRateLimitSecret } from "./runtime-env";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function getClientIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp.slice(0, 64);

  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return (forwarded || "unknown").slice(0, 64);
}

export function rejectCrossOriginMutation(request: Request) {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return null;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return Response.json(
      { error: "허용되지 않은 요청이에요." },
      { status: 403 },
    );
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "요청 출처를 확인할 수 없어요." },
        { status: 403 },
      );
    }
    return null;
  }

  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      return Response.json(
        { error: "허용되지 않은 요청이에요." },
        { status: 403 },
      );
    }
  } catch {
    return Response.json(
      { error: "요청 출처가 올바르지 않아요." },
      { status: 403 },
    );
  }

  return null;
}

export async function readJsonObject(
  request: Request,
  maximumBytes = 16_384,
) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new RequestValidationError("요청 내용이 너무 커요.", 413);
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new RequestValidationError("요청 내용을 읽지 못했어요.", 400);
  }

  if (!text || new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new RequestValidationError(
      text ? "요청 내용이 너무 커요." : "요청 내용이 비어 있어요.",
      text ? 413 : 400,
    );
  }

  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("not an object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new RequestValidationError("요청 형식이 올바르지 않아요.", 400);
  }
}

export class RequestValidationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function requestErrorResponse(error: unknown) {
  if (error instanceof RequestValidationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json(
    { error: "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요." },
    { status: 500 },
  );
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function hashRateIdentifier(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getRateLimitSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(signature));
}

type RateLimitOptions = {
  action: string;
  identifiers: string[];
  maximum: number;
  windowSeconds: number;
};

export async function enforceRateLimit(
  db: D1Database,
  options: RateLimitOptions,
) {
  const windowBucket = Math.floor(Date.now() / (options.windowSeconds * 1000));
  const uniqueIdentifiers = [...new Set(options.identifiers.filter(Boolean))];

  for (const identifier of uniqueIdentifiers) {
    const keyHash = await hashRateIdentifier(
      `${options.action}:${identifier.toLowerCase()}`,
    );
    const result = await db
      .prepare(
        `INSERT INTO security_rate_limits (
           action, key_hash, window_bucket, request_count, updated_at
         ) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(action, key_hash, window_bucket) DO UPDATE SET
           request_count = request_count + 1,
           updated_at = CURRENT_TIMESTAMP
         RETURNING request_count`,
      )
      .bind(options.action, keyHash, windowBucket)
      .first<{ request_count: number }>();

    if ((result?.request_count ?? 1) > options.maximum) {
      return Response.json(
        { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." },
        {
          status: 429,
          headers: { "Retry-After": String(options.windowSeconds) },
        },
      );
    }
  }

  return null;
}

export async function recordSecurityEvent(
  db: D1Database,
  eventType: string,
  subject: string,
  request: Request,
  detail = "",
) {
  try {
    const [subjectHash, ipHash] = await Promise.all([
      hashRateIdentifier(`subject:${subject.toLowerCase()}`),
      hashRateIdentifier(`ip:${getClientIp(request)}`),
    ]);
    await db
      .prepare(
        `INSERT INTO security_audit_logs (
           id, event_type, subject_hash, ip_hash, detail
         ) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        eventType.slice(0, 50),
        subjectHash,
        ipHash,
        detail.slice(0, 200),
      )
      .run();
  } catch {
    // 감사 로그 실패가 사용자의 정상 요청을 막지 않도록 한다.
  }
}

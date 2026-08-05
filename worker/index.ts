/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ROLE_EVIDENCE: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const LEGACY_HOSTNAME = "gachihaeu-uos.changgyu020804.chatgpt.site";
const CANONICAL_HOSTNAME = "www.gachihaeu.com";
let lastEvidenceCleanupAt = 0;

async function cleanupExpiredRoleEvidence(env: Env) {
  const expired = await env.DB
    .prepare(
      `SELECT id, object_key
       FROM role_verification_requests
       WHERE evidence_deleted_at IS NULL
         AND evidence_delete_after IS NOT NULL
         AND datetime(evidence_delete_after) <= datetime('now')
       LIMIT 50`,
    )
    .all<{ id: string; object_key: string }>();

  if (expired.results.length === 0) return;
  await env.ROLE_EVIDENCE.delete(
    expired.results.map((item) => item.object_key),
  );
  await env.DB.batch(
    expired.results.map((item) =>
      env.DB
        .prepare(
          `UPDATE role_verification_requests
           SET evidence_deleted_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(item.id),
    ),
  );
}

function redirectLegacyHostname(request: Request) {
  const url = new URL(request.url);
  if (url.hostname !== LEGACY_HOSTNAME) return null;

  url.protocol = "https:";
  url.hostname = CANONICAL_HOSTNAME;
  url.port = "";
  return Response.redirect(url.toString(), 308);
}

function crossOriginMutationResponse(request: Request) {
  if (
    !new URL(request.url).pathname.startsWith("/api/") ||
    !MUTATION_METHODS.has(request.method.toUpperCase())
  ) {
    return null;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return Response.json(
      { error: "허용되지 않은 요청이에요." },
      { status: 403 },
    );
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return Response.json(
      { error: "요청 출처를 확인할 수 없어요." },
      { status: 403 },
    );
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

function addSecurityHeaders(request: Request, response: Response) {
  const secured = new Response(response.body, response);
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("X-Frame-Options", "DENY");
  secured.headers.set("Referrer-Policy", "same-origin");
  secured.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  secured.headers.set(
    "Content-Security-Policy",
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  secured.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );

  const pathname = new URL(request.url).pathname;
  if (pathname === "/service-worker.js") {
    secured.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    secured.headers.set("Service-Worker-Allowed", "/");
  }
  if (
    pathname.startsWith("/api/auth/") ||
    secured.headers.has("Set-Cookie")
  ) {
    secured.headers.set("Cache-Control", "no-store");
  }

  return secured;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (Date.now() - lastEvidenceCleanupAt >= 60 * 60 * 1000) {
      lastEvidenceCleanupAt = Date.now();
      ctx.waitUntil(cleanupExpiredRoleEvidence(env).catch(() => undefined));
    }
    const legacyRedirect = redirectLegacyHostname(request);
    if (legacyRedirect) return addSecurityHeaders(request, legacyRedirect);

    const originError = crossOriginMutationResponse(request);
    if (originError) return addSecurityHeaders(request, originError);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return addSecurityHeaders(request, response);
    }

    const response = await handler.fetch(request, env, ctx);
    return addSecurityHeaders(request, response);
  },
};

export default worker;

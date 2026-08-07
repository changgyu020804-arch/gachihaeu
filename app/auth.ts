import { cookies } from "next/headers";
import { getJwtSecret, isAppReviewEmail } from "./runtime-env";

export type SessionUser = {
  email: string;
  displayName: string;
  fullName: string | null;
  authenticatedAt: number;
  expiresAt: number;
};

const SESSION_COOKIE = "__Host-gachihaeu_session";
const LEGACY_SESSION_COOKIE = "gachihaeu_session";
const SESSION_IDLE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_ABSOLUTE_SECONDS = 180 * 24 * 60 * 60;
const SESSION_REFRESH_THRESHOLD_SECONDS = 23 * 24 * 60 * 60;
const JWT_ISSUER = "gachihaeu";
const JWT_AUDIENCE = "gachihaeu-web";

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < data.length; index += 1) {
    binary += String.fromCharCode(data[index]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function textToUint8Array(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textToUint8Array(getJwtSecret()) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createJWT(
  payload: Record<string, unknown>,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const authenticatedAt =
    typeof payload.auth_time === "number" ? payload.auth_time : now;
  const fullPayload = {
    ...payload,
    auth_time: authenticatedAt,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: Math.min(
      now + SESSION_IDLE_SECONDS,
      authenticatedAt + SESSION_ABSOLUTE_SECONDS,
    ),
    jti: crypto.randomUUID(),
  };

  const headerEncoded = base64UrlEncode(
    textToUint8Array(JSON.stringify(header)),
  );
  const payloadEncoded = base64UrlEncode(
    textToUint8Array(JSON.stringify(fullPayload)),
  );
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textToUint8Array(signingInput) as unknown as ArrayBuffer,
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyJWT(
  token: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  try {
    const header = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(headerEncoded)),
    ) as Record<string, unknown>;
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;

    const key = await getSigningKey();
    const signature = base64UrlDecode(signatureEncoded);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature as unknown as ArrayBuffer,
      textToUint8Array(signingInput) as unknown as ArrayBuffer,
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadEncoded)),
    ) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    const authenticatedAt =
      typeof payload.auth_time === "number" ? payload.auth_time : payload.iat;

    if (
      payload.iss !== JWT_ISSUER ||
      payload.aud !== JWT_AUDIENCE ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      typeof authenticatedAt !== "number" ||
      payload.iat > now + 60 ||
      authenticatedAt > payload.iat + 60 ||
      payload.exp <= now ||
      payload.exp - payload.iat > SESSION_IDLE_SECONDS ||
      payload.exp > authenticatedAt + SESSION_ABSOLUTE_SECONDS ||
      now - authenticatedAt > SESSION_ABSOLUTE_SECONDS ||
      typeof payload.email !== "string" ||
      !isValidSessionEmail(payload.email)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie?.value) return null;

  const payload = await verifyJWT(sessionCookie.value);
  if (!payload || typeof payload.email !== "string") return null;

  return {
    email: payload.email,
    displayName:
      typeof payload.displayName === "string" && payload.displayName
        ? payload.displayName
        : payload.email.split("@")[0],
    fullName:
      typeof payload.fullName === "string" && payload.fullName
        ? payload.fullName
        : null,
    authenticatedAt:
      typeof payload.auth_time === "number"
        ? payload.auth_time
        : (payload.iat as number),
    expiresAt: payload.exp as number,
  };
}

export function createSessionCookie(
  token: string,
  authenticatedAt = Math.floor(Date.now() / 1000),
): string {
  const now = Math.floor(Date.now() / 1000);
  const maximumAge = Math.max(
    0,
    Math.min(
      SESSION_IDLE_SECONDS,
      authenticatedAt + SESSION_ABSOLUTE_SECONDS - now,
    ),
  );
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=${maximumAge}`;
}

export function shouldRefreshSession(user: SessionUser) {
  const now = Math.floor(Date.now() / 1000);
  return (
    user.expiresAt - now <= SESSION_REFRESH_THRESHOLD_SECONDS &&
    now - user.authenticatedAt < SESSION_ABSOLUTE_SECONDS
  );
}

export function deleteSessionCookies(): string[] {
  return [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0`,
    `${LEGACY_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`,
  ];
}

export function generateAuthCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, "0");
}

export async function hashAuthCode(email: string, code: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textToUint8Array(
      `auth-code:${email.toLowerCase()}:${code}`,
    ) as unknown as ArrayBuffer,
  );
  return base64UrlEncode(new Uint8Array(signature));
}

export function constantTimeEqual(left: string, right: string) {
  const leftBytes = textToUint8Array(left);
  const rightBytes = textToUint8Array(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export function isValidUosEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@uos\.ac\.kr$/.test(normalized);
}

export function isValidSessionEmail(email: string): boolean {
  return isValidUosEmail(email) || isAppReviewEmail(email);
}

export function isReviewSessionEmail(email: string): boolean {
  return isAppReviewEmail(email);
}

export async function hashAttendanceCode(activityId: string, code: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textToUint8Array(`attendance:${activityId}:${code}`) as unknown as ArrayBuffer,
  );
  return base64UrlEncode(new Uint8Array(signature));
}

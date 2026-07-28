import { cookies } from "next/headers";

// --- Types ---

export type SessionUser = {
  email: string;
  displayName: string;
  fullName: string | null;
};

// --- Constants ---

const SESSION_COOKIE = "gachihaeu_session";
const JWT_SECRET_KEY = "REMOVED_HISTORICAL_SECRET"; // 프로덕션에서는 env로 관리
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7일

// --- JWT 유틸 (Web Crypto API 기반) ---

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function textToUint8Array(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textToUint8Array(JWT_SECRET_KEY) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createJWT(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  };

  const headerEncoded = base64UrlEncode(textToUint8Array(JSON.stringify(header)));
  const payloadEncoded = base64UrlEncode(textToUint8Array(JSON.stringify(fullPayload)));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, textToUint8Array(signingInput) as unknown as ArrayBuffer);

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyJWT(token: string): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  try {
    const key = await getSigningKey();
    const signature = base64UrlDecode(signatureEncoded);
    const valid = await crypto.subtle.verify("HMAC", key, signature as unknown as ArrayBuffer, textToUint8Array(signingInput) as unknown as ArrayBuffer);
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadEncoded)));

    // 만료 확인
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// --- 세션 관리 ---

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie?.value) return null;

  const payload = await verifyJWT(sessionCookie.value);
  if (!payload || !payload.email) return null;

  return {
    email: payload.email as string,
    displayName: (payload.displayName as string) || (payload.email as string).split("@")[0],
    fullName: (payload.fullName as string) || null,
  };
}

export function createSessionCookie(token: string): string {
  const maxAge = JWT_EXPIRY_SECONDS;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

export function deleteSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

// --- 인증 코드 생성 ---

export function generateAuthCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

// --- 이메일 도메인 검증 ---

export function isValidUosEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@uos\.ac\.kr$/.test(trimmed);
}

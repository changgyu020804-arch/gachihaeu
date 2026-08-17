import { env } from "cloudflare:workers";

type RuntimeEnvironment = {
  JWT_SECRET?: string;
  RATE_LIMIT_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  ADMIN_EMAILS?: string;
};

const runtimeEnv = env as unknown as RuntimeEnvironment;

function readRuntimeValue(key: keyof RuntimeEnvironment) {
  const value = runtimeEnv[key] ?? process.env[key];
  return typeof value === "string" ? value.trim() : "";
}

function requireRuntimeValue(
  key: keyof RuntimeEnvironment,
  minimumLength = 1,
) {
  const value = readRuntimeValue(key);
  if (value.length < minimumLength) {
    throw new Error(`필수 서버 보안 설정이 없습니다: ${key}`);
  }
  return value;
}

export function getJwtSecret() {
  return requireRuntimeValue("JWT_SECRET", 43);
}

export function getRateLimitSecret() {
  return requireRuntimeValue("RATE_LIMIT_SECRET", 32);
}

export function getResendConfig() {
  const apiKey = requireRuntimeValue("RESEND_API_KEY", 10);
  const fromEmail = requireRuntimeValue("RESEND_FROM_EMAIL", 5);

  if (!apiKey.startsWith("re_")) {
    throw new Error("RESEND_API_KEY 형식이 올바르지 않습니다.");
  }
  if (!fromEmail.includes("@")) {
    throw new Error("RESEND_FROM_EMAIL 형식이 올바르지 않습니다.");
  }

  return { apiKey, fromEmail };
}

export function isAdminEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return getAdminEmails().includes(normalized);
}

export function getAdminEmails() {
  return readRuntimeValue("ADMIN_EMAILS")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

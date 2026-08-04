export const NICKNAME_MAX_LENGTH = 20;

export function cleanNickname(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NICKNAME_MAX_LENGTH);
}

export function normalizeNickname(nickname: string) {
  return cleanNickname(nickname).toLocaleLowerCase("ko-KR");
}

export function isNicknameConflictError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();

  return (
    message.includes("unique") && message.includes("nickname_normalized")
  );
}

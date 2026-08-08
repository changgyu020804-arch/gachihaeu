const BLOCKED_TERMS = ["씨발", "시발", "병신", "개새끼", "꺼져"];

const CONTACT_PATTERN =
  /(?:01[016789][-\s]?\d{3,4}[-\s]?\d{4}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|(?:카카오톡|카톡|오픈채팅|인스타|instagram|텔레그램|telegram)\s*[:@]?)/i;

export function cleanUserText(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().slice(0, maximumLength)
    : "";
}

export function hasUnsafeUserText(value: string) {
  const normalized = value.replace(/\s/g, "").toLowerCase();
  return (
    CONTACT_PATTERN.test(value) ||
    BLOCKED_TERMS.some((term) => normalized.includes(term.replace(/\s/g, "")))
  );
}

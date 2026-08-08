export const APP_URL = "https://www.gachihaeu.com/";

const INTERNAL_HOSTS = new Set(["www.gachihaeu.com", "gachihaeu.com"]);
const EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:"]);

export function isInternalUrl(value: string) {
  if (value === "about:blank") return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && INTERNAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function canOpenOutsideApp(value: string) {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

const MAX_URL_LENGTH = 2048;
const BLOCKED_PROTOCOL = /^(javascript|data|file|vbscript|blob):/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export type SanitizeUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Coaches may store http(s) links only — never javascript: / data: / IPs. */
export function sanitizeShareUrl(raw: string): SanitizeUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Add a URL." };
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: "That URL is too long." };
  }
  if (BLOCKED_PROTOCOL.test(trimmed)) {
    return { ok: false, error: "Use an https link." };
  }

  let candidate = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, "")}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: "That doesn’t look like a valid URL." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Use an http or https link." };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) return { ok: false, error: "That doesn’t look like a valid URL." };
  if (IPV4.test(host) && host !== "127.0.0.1") {
    return { ok: false, error: "Use a website address, not an IP." };
  }
  if (host !== "localhost" && host !== "127.0.0.1" && !host.includes(".")) {
    return { ok: false, error: "That doesn’t look like a valid URL." };
  }

  parsed.hash = "";
  return { ok: true, url: parsed.toString() };
}

export function isSafeHttpUrl(raw: string): boolean {
  return sanitizeShareUrl(raw).ok;
}

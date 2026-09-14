const IG_HOSTS = new Set(["instagram.com", "www.instagram.com", "instagr.am"]);

const RESERVED_PATHS = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "accounts",
  "direct",
  "tv",
  "about",
  "legal",
  "developer",
]);

/** Instagram usernames: 1–30 letters, numbers, periods, underscores. */
const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;

function looksLikeUrl(value: string): boolean {
  return (
    /^https?:\/\//i.test(value) ||
    /^[a-z0-9.-]*instagram\.com\//i.test(value) ||
    /^instagr\.am\//i.test(value)
  );
}

export function instagramUsername(
  raw: string | null | undefined
): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;

  if (!looksLikeUrl(trimmed)) {
    const handle = trimmed.replace(/^@/, "");
    return USERNAME_RE.test(handle) ? handle.toLowerCase() : null;
  }

  try {
    const url = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(`https://${trimmed.replace(/^\/+/, "")}`);
    const host = url.hostname.toLowerCase();
    if (!IG_HOSTS.has(host)) return null;
    const segment = url.pathname.split("/").filter(Boolean)[0] || "";
    if (!segment || RESERVED_PATHS.has(segment.toLowerCase())) return null;
    if (!USERNAME_RE.test(segment)) return null;
    return segment.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeInstagramProfileUrl(
  raw: string | null | undefined
): string | null {
  const username = instagramUsername(raw);
  return username ? `https://www.instagram.com/${username}/` : null;
}

const FB_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "fb.com",
  "www.fb.com",
]);

const RESERVED_PATHS = new Set([
  "share",
  "watch",
  "events",
  "groups",
  "marketplace",
  "reel",
  "reels",
  "stories",
  "photo",
  "photos",
  "permalink.php",
  "story.php",
  "login",
  "dialog",
  "help",
  "policies",
  "privacy",
  "settings",
]);

/** Facebook usernames / vanity paths. */
const USERNAME_RE = /^[A-Za-z0-9.]{3,50}$/;

export function facebookProfileIdentifier(
  raw: string | null | undefined
): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;

  const asHandle = trimmed.replace(/^@/, "");
  if (USERNAME_RE.test(asHandle) && !trimmed.includes("/") && !/^https?:/i.test(trimmed)) {
    return asHandle;
  }

  try {
    const url = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(`https://${trimmed.replace(/^\/+/, "")}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!FB_HOSTS.has(url.hostname.toLowerCase()) && !FB_HOSTS.has(host) && host !== "facebook.com" && host !== "fb.com") {
      return null;
    }

    const id = url.searchParams.get("id");
    if (id && /^\d{5,}$/.test(id)) return id;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0]?.toLowerCase() === "profile.php" && id) return id;
    if (parts[0]?.toLowerCase() === "people" && parts[2] && /^\d{5,}$/.test(parts[2])) {
      return parts[2];
    }
    const segment = parts[0] || "";
    if (!segment || RESERVED_PATHS.has(segment.toLowerCase())) return null;
    if (/^\d{5,}$/.test(segment)) return segment;
    if (!USERNAME_RE.test(segment)) return null;
    return segment;
  } catch {
    return USERNAME_RE.test(asHandle) ? asHandle : null;
  }
}

export function normalizeFacebookProfileUrl(
  raw: string | null | undefined
): string | null {
  const id = facebookProfileIdentifier(raw);
  if (!id) return null;
  if (/^\d{5,}$/.test(id)) return `https://www.facebook.com/profile.php?id=${id}`;
  return `https://www.facebook.com/${id}`;
}

/** LinkedIn URL helpers for outreach imports. */

const PROFILE_RE =
  /linkedin\.com\/in\/([A-Za-z0-9_%-]+)\/?/i;

export function normalizeLinkedInProfileUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url.replace(/^\/+/, "")}`;
  }
  try {
    const u = new URL(url);
    if (!/linkedin\.com$/i.test(u.hostname.replace(/^www\./, ""))) {
      // allow www.linkedin.com
      if (!u.hostname.toLowerCase().endsWith("linkedin.com")) return null;
    }
    const m = u.pathname.match(/^\/in\/([A-Za-z0-9_%-]+)\/?/i);
    if (!m?.[1]) return null;
    const slug = decodeURIComponent(m[1]).replace(/\/+$/, "");
    if (!slug) return null;
    return `https://www.linkedin.com/in/${encodeURIComponent(slug).replace(/%2F/gi, "")}/`;
  } catch {
    return null;
  }
}

/** Public profile URL from Unipile attendee/user fields. */
export function hrefFromUnipileLinkedIn(
  profileUrl?: string | null,
  publicIdentifier?: string | null
): string | null {
  const fromUrl = profileUrl?.trim() || null;
  if (fromUrl) {
    const normalized = normalizeLinkedInProfileUrl(fromUrl);
    if (normalized) return normalized;
    try {
      const withProtocol = /^https?:\/\//i.test(fromUrl)
        ? fromUrl
        : `https://${fromUrl.replace(/^\/+/, "")}`;
      const parsed = new URL(withProtocol);
      if (parsed.hostname.toLowerCase().endsWith("linkedin.com")) {
        return parsed.toString();
      }
    } catch {
      /* ignore */
    }
  }
  const slug = (publicIdentifier || "").trim();
  if (!slug) return null;
  if (/^AC[ow]/i.test(slug) || slug.includes(":")) return null;
  return `https://www.linkedin.com/in/${encodeURIComponent(slug)}/`;
}

export function linkedInPublicIdentifier(url: string): string | null {
  const normalized = normalizeLinkedInProfileUrl(url);
  if (!normalized) return null;
  const m = normalized.match(PROFILE_RE);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export function renderOutreachTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v != null && String(v).trim() ? String(v).trim() : "";
  });
}

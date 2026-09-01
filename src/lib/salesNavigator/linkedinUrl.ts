/** Browser-safe LinkedIn profile URL helpers (no Node built-ins). */

const SLUG_RE = /^[a-zA-Z0-9\-_%]+$/;
/** Sales Nav / member-id slug: AC + one char + AA + long base64url tail. */
const MEMBER_ID_RE = /^ac[a-z0-9]aa[a-z0-9_-]{10,}$/i;

function parseLinkedInUrl(input: string | null | undefined): URL | null {
  const raw = input?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
    return url;
  } catch {
    return null;
  }
}

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** /in/{slug} or Sales Nav /sales/lead|people/{id} (comma suffix stripped). */
export function linkedInProfileSlug(
  input: string | null | undefined
): string | null {
  const url = parseLinkedInUrl(input);
  if (!url) return null;
  const parts = url.pathname.split("/").filter(Boolean);

  const inIdx = parts.findIndex((p) => p.toLowerCase() === "in");
  if (inIdx >= 0 && parts[inIdx + 1]) {
    const slug = decodeSlug(parts[inIdx + 1].replace(/\/+$/, ""));
    return slug && SLUG_RE.test(slug) ? slug : null;
  }

  const salesIdx = parts.findIndex((p) => p.toLowerCase() === "sales");
  if (salesIdx >= 0) {
    const kind = (parts[salesIdx + 1] || "").toLowerCase();
    const idRaw = parts[salesIdx + 2];
    if ((kind === "lead" || kind === "people") && idRaw) {
      const id = decodeSlug(idRaw.replace(/\/+$/, "")).split(",")[0].trim();
      return id && SLUG_RE.test(id) ? id : null;
    }
  }

  return null;
}

export function isLinkedInMemberIdSlug(slug: string | null | undefined): boolean {
  return Boolean(slug && MEMBER_ID_RE.test(slug));
}

/**
 * Clickable profile URL in the form Sales Nav scrapes:
 * `https://www.linkedin.com/in/{slug}` with original case.
 * Member IDs (ACw…) 404 when lowercased — do not fold case here.
 */
export function canonicalLinkedInProfileUrl(
  input: string | null | undefined
): string | null {
  const slug = linkedInProfileSlug(input);
  if (!slug) return null;
  return `https://www.linkedin.com/in/${slug}`;
}

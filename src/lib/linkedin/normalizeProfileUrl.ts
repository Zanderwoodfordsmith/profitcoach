/**
 * Client-safe LinkedIn profile URL normalization (no Apify / network).
 * Accepts common shapes and returns a canonical URL:
 * - https://www.linkedin.com/in/{slug}
 * - https://www.linkedin.com/sales/lead|people/{memberId}
 * or null if invalid.
 */
export function normalizeLinkedInProfileUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const inIdx = parts.findIndex((p) => p.toLowerCase() === "in");
  if (inIdx >= 0 && parts[inIdx + 1]) {
    const slug = parts[inIdx + 1].replace(/\/+$/, "");
    if (slug && /^[a-zA-Z0-9\-_%]+$/.test(slug)) {
      return `https://www.linkedin.com/in/${decodeURIComponent(slug)}`;
    }
  }

  // Sales Navigator lead / people pages (extension + imports).
  const salesIdx = parts.findIndex((p) => p.toLowerCase() === "sales");
  if (salesIdx >= 0) {
    const kind = (parts[salesIdx + 1] || "").toLowerCase();
    const idRaw = parts[salesIdx + 2];
    if ((kind === "lead" || kind === "people") && idRaw) {
      let id = idRaw.replace(/\/+$/, "");
      try {
        id = decodeURIComponent(id);
      } catch {
        // keep raw
      }
      id = id.split(",")[0].trim();
      if (id && /^[A-Za-z0-9_-]+$/.test(id)) {
        return `https://www.linkedin.com/sales/${kind}/${id}`;
      }
    }
  }

  return null;
}

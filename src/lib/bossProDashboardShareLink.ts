import { getAppBaseUrl } from "./appBaseUrl";

/** URL-safe slug from a contact business name (readable path segment). */
export function slugifyBusinessName(name: string | null | undefined): string {
  const slug = (name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "client";
}

/** Public read-only Boss Pro workshop dashboard for a contact. */
export function buildBossProDashboardShareUrl(
  coachSlug: string,
  businessName: string | null | undefined,
  dashboardShareToken: string,
  baseUrl?: string
): string {
  const origin = (baseUrl ?? getAppBaseUrl()).replace(/\/$/, "");
  const slug = coachSlug.trim().toLowerCase();
  const businessSlug = slugifyBusinessName(businessName);
  const token = dashboardShareToken.trim();
  return `${origin}/dashboard/${encodeURIComponent(slug)}/${encodeURIComponent(businessSlug)}/${encodeURIComponent(token)}`;
}

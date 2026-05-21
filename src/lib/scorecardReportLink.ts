import { getAppBaseUrl } from "./appBaseUrl";

/** Public shareable BOSS scorecard results page for a prospect. */
export function buildScorecardReportUrl(
  coachSlug: string,
  reportToken: string,
  baseUrl?: string
): string {
  const origin = (baseUrl ?? getAppBaseUrl()).replace(/\/$/, "");
  const slug = coachSlug.trim();
  const token = reportToken.trim();
  return `${origin}/assessment/${encodeURIComponent(slug)}/report?token=${encodeURIComponent(token)}`;
}

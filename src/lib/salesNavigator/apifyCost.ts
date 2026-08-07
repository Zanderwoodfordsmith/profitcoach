/**
 * HarvestAPI Sales Navigator lead-search-cookie — pay per event (verified via Apify API).
 * We only use Short mode (search pages). Full / Full+email are not used on import.
 */

/** USD charged per Sales Nav search page (≤25 Short profiles). */
export const APIFY_SALES_NAV_SEARCH_PAGE_USD = 0.002;

/** USD per Full profile (not used on import; kept for reference). */
export const APIFY_SALES_NAV_FULL_PROFILE_USD = 0.004;

/** USD per Full profile + email search (not used on import). */
export const APIFY_SALES_NAV_FULL_PROFILE_EMAIL_USD = 0.01;

export type SalesNavProfileScraperMode = "Short" | "Full" | "Full+email";

/** Estimated Apify cost for a Short-mode scrape of `takePages` pages. */
export function estimateSalesNavShortCostUsd(takePages: number): number {
  const pages = Math.max(0, Math.floor(takePages));
  return Number((pages * APIFY_SALES_NAV_SEARCH_PAGE_USD).toFixed(4));
}

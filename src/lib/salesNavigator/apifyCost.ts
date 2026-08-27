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

export type SalesNavProfileScraperMode = "Short" | "Full" | "Full + email search";

/** Estimated Apify cost for a Short-mode scrape of `takePages` pages. */
export function estimateSalesNavShortCostUsd(takePages: number): number {
  const pages = Math.max(0, Math.floor(takePages));
  return Number((pages * APIFY_SALES_NAV_SEARCH_PAGE_USD).toFixed(4));
}

/** Rough Apify cost for search + optional Full profile opens. */
export function estimateSalesNavImportCostUsd(opts: {
  takePages: number;
  profileCount?: number;
  mode?: SalesNavProfileScraperMode;
}): number {
  const pages = Math.max(0, Math.floor(opts.takePages));
  const profiles = Math.max(0, Math.floor(opts.profileCount ?? pages * 25));
  const base = pages * APIFY_SALES_NAV_SEARCH_PAGE_USD;
  const mode = opts.mode ?? "Short";
  if (mode === "Full") {
    return Number((base + profiles * APIFY_SALES_NAV_FULL_PROFILE_USD).toFixed(4));
  }
  if (mode === "Full + email search") {
    return Number(
      (base + profiles * APIFY_SALES_NAV_FULL_PROFILE_EMAIL_USD).toFixed(4)
    );
  }
  return Number(base.toFixed(4));
}

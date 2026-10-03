/** Pay-per-event rates for apify/google-search-scraper.
 *  Page price is the published floor ($1.80 / 1,000 pages).
 *  Owner lookup is quoted like Maps ($0.005) so the card is comparable.
 *  Smaller Apify plans can charge more than this quote.
 */

export const GOOGLE_SEARCH_PAGE_USD = 0.0018;
export const GOOGLE_SEARCH_LEAD_USD = 0.005;
export const GOOGLE_SEARCH_RESULTS_PER_PAGE = 10;

export const GOOGLE_SEARCH_MAX_RESULTS = 1_000;
export const GOOGLE_SEARCH_SIZE_OPTIONS = [20, 50, 100, 250, 500, 1_000] as const;

export function clampGoogleSearchMaxResults(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(GOOGLE_SEARCH_MAX_RESULTS, n);
}

export function estimateGoogleSearchCostUsd(opts: {
  maxResults: number;
  queryCount: number;
  findPeople: boolean;
}): number {
  const results = clampGoogleSearchMaxResults(opts.maxResults);
  const queries = Math.max(1, Math.floor(opts.queryCount) || 1);
  const pages = queries * googleSearchPagesPerQuery(results, queries);
  let usd = pages * GOOGLE_SEARCH_PAGE_USD;
  if (opts.findPeople) usd += results * GOOGLE_SEARCH_LEAD_USD;
  return Number(usd.toFixed(4));
}

/** Pages the actor should open for one query so the set lands near maxResults. */
export function googleSearchPagesPerQuery(
  maxResults: number,
  searchCount: number
): number {
  const results = clampGoogleSearchMaxResults(maxResults);
  const n = Math.max(1, Math.floor(Number(searchCount)) || 1);
  const perQuery = Math.ceil(results / n);
  return Math.max(
    1,
    Math.min(100, Math.ceil(perQuery / GOOGLE_SEARCH_RESULTS_PER_PAGE))
  );
}

const GOOGLE_SEARCH_DURATION_MINUTES: Record<number, number> = {
  20: 2,
  50: 5,
  100: 10,
  250: 25,
  500: 50,
  1000: 60,
};

export function googleSearchApproxMinutes(maxResults: number): number {
  const results = clampGoogleSearchMaxResults(maxResults);
  const exact = GOOGLE_SEARCH_DURATION_MINUTES[results];
  if (exact) return exact;
  return Math.max(2, Math.round(results / 10));
}

export function formatGoogleSearchApproxDuration(maxResults: number): string {
  const mins = googleSearchApproxMinutes(maxResults);
  if (mins >= 60) return "1 hr";
  return `${mins} min`;
}

export function formatGoogleSearchSizeOption(maxResults: number): string {
  const results = clampGoogleSearchMaxResults(maxResults);
  return `${results.toLocaleString()} businesses (${formatGoogleSearchApproxDuration(results)})`;
}

export function googleSearchImportProgressPercent(opts: {
  progressCount: number;
  targetCount: number;
  startedAtMs: number;
  nowMs?: number;
  phase?: "scraping" | "finalizing";
}): number {
  const target = Math.max(1, opts.targetCount);
  const real = Math.min(
    100,
    Math.round((Math.max(0, opts.progressCount) / target) * 100)
  );
  if (opts.phase === "finalizing") return Math.max(real, 92);
  const elapsedSec = Math.max(
    0,
    ((opts.nowMs ?? Date.now()) - opts.startedAtMs) / 1000
  );
  const soft = Math.min(
    85,
    Math.round((elapsedSec / (googleSearchApproxMinutes(target) * 60)) * 100)
  );
  return Math.max(real, soft);
}

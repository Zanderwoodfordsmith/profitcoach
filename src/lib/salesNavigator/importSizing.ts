/** Browser-safe helpers for Sales Nav import sizing / over-fetch. */

import {
  SALES_NAV_DEFAULT_TAKE_PAGES,
  SALES_NAV_MAX_TAKE_PAGES,
} from "@/lib/apify/salesNavigatorTypes";

/** Ask Apify for this much more than the coach requested (buffer for soft shortfalls). */
export const SALES_NAV_OVERFETCH_RATIO = 1.25;

export function clampSalesNavTakePages(pages: number): number {
  return Math.min(
    SALES_NAV_MAX_TAKE_PAGES,
    Math.max(1, Math.floor(Number.isFinite(pages) ? pages : 1))
  );
}

export function normalizeRequestedTakePages(takePages?: number): number {
  return clampSalesNavTakePages(
    takePages ?? SALES_NAV_DEFAULT_TAKE_PAGES
  );
}

/** Pages to send Apify for a coach request (capped at LinkedIn max). */
export function apifyTakePagesForRequest(
  requestedTakePages: number,
  opts?: { skipOverfetch?: boolean }
): number {
  const requested = normalizeRequestedTakePages(requestedTakePages);
  if (opts?.skipOverfetch) return requested;
  return clampSalesNavTakePages(
    Math.ceil(requested * SALES_NAV_OVERFETCH_RATIO)
  );
}

export function salesNavLeadTarget(takePages: number): number {
  return normalizeRequestedTakePages(takePages) * 25;
}

export function requestedTakePagesFromTargetCount(targetCount: number): number {
  return normalizeRequestedTakePages(
    Math.ceil(Math.max(1, Math.floor(targetCount)) / 25)
  );
}

/** Optional coach-facing pool caps. Null / omitted = full extract (LinkedIn max). */
export const SALES_NAV_POOL_LIMIT_OPTIONS = [
  100, 250, 500, 1_000, 2_500,
] as const;

export type SalesNavPoolLimitOption =
  (typeof SALES_NAV_POOL_LIMIT_OPTIONS)[number];

/** UI select value: "all" or a capped count. */
export type SalesNavPoolSizeValue = "all" | SalesNavPoolLimitOption;

export function parseSalesNavPoolLimit(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "" || raw === "all") {
    return null;
  }
  const n = Math.floor(Number(raw));
  return (SALES_NAV_POOL_LIMIT_OPTIONS as readonly number[]).includes(n)
    ? n
    : null;
}

/** Null = import every extractable result (per-query cap still applies). */
export function salesNavGlobalLeadCapFromPages(
  requestedTakePages: number
): number | null {
  const pages = normalizeRequestedTakePages(requestedTakePages);
  if (pages >= SALES_NAV_MAX_TAKE_PAGES) return null;
  return salesNavLeadTarget(pages);
}

/**
 * Soft duration band from the timed ~1,000-lead (~40 page) run ≈ 6–9 min.
 * Window stays about 3–5 minutes wide as size scales.
 */
export function approxImportDurationRangeMinutes(requestedTakePages: number): {
  low: number;
  high: number;
} {
  const pages = normalizeRequestedTakePages(requestedTakePages);
  const scale = pages / 40;
  const low = Math.max(1, Math.round(6 * scale));
  let high = Math.max(low + 2, Math.round(9 * scale));
  if (high - low > 5) high = low + 5;
  return { low, high };
}

export function formatApproxImportDuration(requestedTakePages: number): string {
  const { low, high } = approxImportDurationRangeMinutes(requestedTakePages);
  return `Approx. ${low}–${high} min`;
}


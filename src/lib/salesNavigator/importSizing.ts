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
export function apifyTakePagesForRequest(requestedTakePages: number): number {
  const requested = normalizeRequestedTakePages(requestedTakePages);
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


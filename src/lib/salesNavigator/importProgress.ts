import { SALES_NAV_MAX_LEADS } from "@/lib/apify/salesNavigatorTypes";

/** Dedup key used for import snapshots (LinkedIn URL, else name+company). */
export function salesNavLeadDedupeKey(row: {
  linkedinUrl?: string | null;
  fullName?: string | null;
  company?: string | null;
}): string {
  const url = row.linkedinUrl?.trim().toLowerCase() || "";
  if (url) return url;
  return `${row.fullName ?? ""}|${row.company ?? ""}`.toLowerCase();
}

export function segmentScrapedCap(opts: {
  searchTotalCount?: number | null;
  pageTarget: number;
  importAll: boolean;
}): number {
  const total =
    typeof opts.searchTotalCount === "number" &&
    Number.isFinite(opts.searchTotalCount) &&
    opts.searchTotalCount >= 0
      ? Math.floor(opts.searchTotalCount)
      : null;
  const safety = opts.importAll
    ? SALES_NAV_MAX_LEADS
    : Math.max(1, opts.pageTarget);
  if (total != null) return Math.max(1, Math.min(safety, total));
  return safety;
}

/**
 * Coach-facing denominator. Once Unipile reports per-band totals, show that
 * (e.g. ~400 1st-degree owners) instead of the 2,500 LinkedIn extract cap.
 */
export function jobDisplayTargetCount(opts: {
  pageTarget: number;
  progressCount?: number;
  segmentPlan?: Array<{ searchTotalCount?: number | null }> | null;
  importAll: boolean;
}): number {
  const plan = opts.segmentPlan ?? [];
  const totals = plan
    .map((s) => s.searchTotalCount)
    .filter(
      (n): n is number =>
        typeof n === "number" && Number.isFinite(n) && n >= 0
    )
    .map((n) => Math.floor(n));
  if (totals.length === 0) return Math.max(1, opts.pageTarget);
  const sum = totals.reduce((a, b) => a + b, 0);
  if (totals.length === plan.length && plan.length > 0) {
    if (opts.importAll) return Math.max(1, sum);
    return Math.max(1, Math.min(opts.pageTarget, sum));
  }
  return Math.max(1, sum, opts.progressCount ?? 0);
}

export function shouldFinishUnipileSegment(opts: {
  scrapedCount: number;
  scrapedCap: number;
  nextCursor: string | null;
  stalledCursor: boolean;
  itemsLength: number;
  newUniqueCount: number;
}): boolean {
  if (opts.scrapedCount >= opts.scrapedCap) return true;
  if (!opts.nextCursor || opts.stalledCursor || opts.itemsLength === 0) {
    return true;
  }
  // Unipile/LinkedIn often keep issuing cursors after the unique set is
  // exhausted — paging those duplicates toward 2,500 is what hung imports.
  if (opts.itemsLength > 0 && opts.newUniqueCount === 0) return true;
  return false;
}

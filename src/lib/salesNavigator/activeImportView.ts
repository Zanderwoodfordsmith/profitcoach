/**
 * Coach-facing progress for a Sales Navigator import that has not landed
 * in the list yet. Safe to import from client components.
 */

export type SalesNavImportProgressView = {
  id: string;
  name: string | null;
  saveListId: string | null;
  listId: string | null;
  startedAt: string | null;
  progressCount: number;
  /** Status is succeeded and the list write has not finished. */
  finalizing: boolean;
  segmentIndex: number;
  segmentTotal: number;
  segmentLabel: string | null;
  segmentScraped: number;
  segmentTotalCount: number | null;
  upcomingLabels: string[];
  /** Sum of every band once LinkedIn has counted them all. */
  overallTotal: number | null;
};

type SegmentBits = {
  label: string;
  scrapedCount: number;
  searchTotalCount: number | null;
};

function readSegments(plan: unknown): SegmentBits[] {
  if (!Array.isArray(plan)) return [];
  const out: SegmentBits[] = [];
  for (const item of plan) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!label) continue;
    const total = row.searchTotalCount;
    const scraped = Number(row.scrapedCount ?? 0);
    out.push({
      label,
      scrapedCount: Number.isFinite(scraped) && scraped > 0 ? Math.floor(scraped) : 0,
      searchTotalCount:
        typeof total === "number" && Number.isFinite(total) && total >= 0
          ? Math.floor(total)
          : null,
    });
  }
  return out;
}

export function toSalesNavImportProgressView(row: {
  id: string;
  name?: string | null;
  status?: string | null;
  progress_count?: number | null;
  segment_index?: number | null;
  segment_total?: number | null;
  segment_plan?: unknown;
  list_id?: string | null;
  save_list_id?: string | null;
  saved_to_list?: boolean | null;
  started_at?: string | null;
}): SalesNavImportProgressView {
  const segments = readSegments(row.segment_plan);
  const segmentTotal = Math.max(
    1,
    Number(row.segment_total ?? 0) || segments.length || 1
  );
  const segmentIndex = Math.min(
    Math.max(0, Number(row.segment_index ?? 0) || 0),
    Math.max(0, segments.length - 1)
  );
  const current = segments[segmentIndex] ?? null;
  const totals = segments.map((s) => s.searchTotalCount);
  const overallTotal =
    segments.length > 0 && totals.every((n) => n != null)
      ? totals.reduce((sum, n) => sum + (n ?? 0), 0)
      : null;
  const progressCount = Math.max(0, Number(row.progress_count ?? 0) || 0);
  const saved = Boolean(row.saved_to_list);
  const finalizing = row.status === "succeeded" && !saved;

  return {
    id: row.id,
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : null,
    saveListId: row.save_list_id ?? null,
    listId: row.list_id ?? null,
    startedAt: row.started_at ?? null,
    progressCount,
    finalizing,
    segmentIndex,
    segmentTotal,
    segmentLabel: current?.label ?? null,
    segmentScraped: current?.scrapedCount ?? progressCount,
    segmentTotalCount: current?.searchTotalCount ?? null,
    upcomingLabels: segments.slice(segmentIndex + 1).map((s) => s.label),
    overallTotal: overallTotal && overallTotal > 0 ? overallTotal : null,
  };
}

export function progressViewMatchingList(
  listId: string,
  active: SalesNavImportProgressView[]
): SalesNavImportProgressView | null {
  return (
    active.find((job) => job.saveListId === listId || job.listId === listId) ??
    null
  );
}

/** Until the server poll returns, show whatever this browser already watched. */
export function watchedSalesNavProgressView(
  job: {
    id: string;
    name: string | null;
    targetCount: number;
    startedAt: string;
    saveListId?: string | null;
  },
  live?: {
    progressCount: number;
    targetCount: number;
    name: string | null;
    phase: "scraping" | "finalizing";
  } | null
): SalesNavImportProgressView {
  const progressCount = Math.max(0, live?.progressCount ?? 0);
  const target = Math.max(0, live?.targetCount || job.targetCount || 0);
  return {
    id: job.id,
    name: live?.name?.trim() || job.name,
    saveListId: job.saveListId ?? null,
    listId: null,
    startedAt: job.startedAt,
    progressCount,
    finalizing: live?.phase === "finalizing",
    segmentIndex: 0,
    segmentTotal: 1,
    segmentLabel: null,
    segmentScraped: progressCount,
    segmentTotalCount: target > 0 ? target : null,
    upcomingLabels: [],
    overallTotal: target > 0 ? target : null,
  };
}

/** Bar percent. Current band until every band has a count, then the whole import. */
export function salesNavImportBarPercent(
  view: SalesNavImportProgressView
): number | null {
  if (view.finalizing) return 100;
  if (view.overallTotal && view.overallTotal > 0) {
    return Math.min(
      100,
      Math.round((view.progressCount / view.overallTotal) * 100)
    );
  }
  if (view.segmentTotalCount && view.segmentTotalCount > 0) {
    return Math.min(
      100,
      Math.round((view.segmentScraped / view.segmentTotalCount) * 100)
    );
  }
  return null;
}

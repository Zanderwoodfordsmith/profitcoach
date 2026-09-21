/**
 * Background Sales Nav import via Unipile search pagination.
 * Same sales_nav_import_runs table as Apify — do not replace the cookie scrape.
 *
 * Uses the same team-size URL split as Apify so cache rows get a single
 * COMPANY_HEADCOUNT stamp (search results do not include headcount).
 * When Unipile paging.total_count shows a band still ≥ 2,500, that segment
 * is rewritten into years-at-company (then years-in-role) URLs so import
 * can continue past LinkedIn’s extract cap.
 */

import { isSalesNavSearchUrl } from "@/lib/salesNavigator/isSalesNavSearchUrl";
import { toSalesNavImportLeadSnapshot } from "@/lib/salesNavigator/importLeadSnapshot";
import {
  loadImportJob,
  mergeSalesNavLeadSnapshots,
  requestedPagesForJob,
  supersedeRunningSalesNavImports,
  type SalesNavImportJobRow,
} from "@/lib/salesNavigator/importJob";
import {
  planSalesNavImportSegments,
  shouldProbeSalesNavExtractCap,
  spliceSegmentPlan,
  subSplitOverExtractCap,
  SALES_NAV_EXTRACT_CAP,
  type SalesNavImportSegmentPlan,
} from "@/lib/salesNavigator/importSegments";
import {
  segmentScrapedCap,
  shouldFinishUnipileSegment,
} from "@/lib/salesNavigator/importProgress";
import {
  normalizeRequestedTakePages,
  salesNavGlobalLeadCapFromPages,
  salesNavLeadTarget,
} from "@/lib/salesNavigator/importSizing";
import { upsertSalesNavLeadsToCache } from "@/lib/salesNavigator/upsertSalesNavLeadsToCache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { flushSalesNavSnapshotToList } from "@/lib/salesNavigator/flushImportToList";
import { isUnipileConfigured, linkedInSearch, unipileLinkedInAccountError } from "@/lib/unipile/client";
import {
  nextUnipileUrlSearchCursor,
  salesNavUrlForUnipile,
} from "@/lib/unipile/linkedinSearchCursor";
import { requireLiveLinkedInUnipileAccount } from "@/lib/unipile/linkedinSearchAccount";
import { mapUnipileSearchItem } from "@/lib/unipile/salesNavLeads";

const UNIPILE_PAGE_SIZE = 100;
/** Pages per poll/tick — keep each sync under typical serverless time. */
const PAGES_PER_SYNC = 12;
const PAGE_DELAY_MS = 250;
/** Coach GET is 60s; stop the tick in time to persist cursor. Cron ticks can chain. */
const TICK_BUDGET_MS = 20_000;
const SEARCH_TIMEOUT_MS = 20_000;

const syncInFlight = new Map<string, Promise<SalesNavImportJobRow>>();

function isRetryableUnipileSearch(res: {
  ok: boolean;
  status: number;
  error?: string;
}): boolean {
  if (res.ok) return false;
  if (res.status === 429 || res.status === 503 || res.status === 504) return true;
  const blob = `${res.error ?? ""}`.toLowerCase();
  return (
    res.status === 0 &&
    (blob.includes("timed out") ||
      blob.includes("timeout") ||
      blob.includes("network") ||
      blob.includes("fetch"))
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function markFailed(
  jobId: string,
  startedAt: string | null,
  createdAt: string,
  message: string
): Promise<SalesNavImportJobRow> {
  const finishedAt = new Date().toISOString();
  const startMs = Date.parse(startedAt || createdAt);
  const durationMs = Number.isFinite(startMs)
    ? Math.max(0, Date.now() - startMs)
    : null;
  await supabaseAdmin
    .from("sales_nav_import_runs")
    .update({
      status: "failed",
      error_message: message.slice(0, 2000),
      finished_at: finishedAt,
      duration_ms: durationMs,
    })
    .eq("id", jobId);
  const failed = await loadImportJob(jobId);
  if (!failed) throw new Error(message);
  return failed;
}

type UnipileSearchPage = {
  items?: Array<Record<string, unknown>>;
  cursor?: string | null;
  next_cursor?: string | null;
  paging?: {
    cursor?: string | null;
    total_count?: number | null;
  } | null;
  total_count?: number | null;
};

function nextCursorFromSearch(
  data: UnipileSearchPage | null | undefined
): string | null {
  const cursor =
    data?.cursor ||
    data?.next_cursor ||
    data?.paging?.cursor ||
    null;
  const trimmed = typeof cursor === "string" ? cursor.trim() : "";
  return trimmed || null;
}

function searchTotalCount(
  data: UnipileSearchPage | null | undefined
): number | null {
  const n = data?.paging?.total_count ?? data?.total_count;
  if (typeof n === "number" && Number.isFinite(n) && n >= 0) return n;
  return null;
}

export async function createUnipileSalesNavImportJob(opts: {
  coachId: string;
  salesNavUrl: string;
  name?: string | null;
  takePages?: number;
  listId?: string | null;
  saveListId?: string | null;
}): Promise<{
  jobId: string;
  takePages: number;
  requestedTakePages: number;
  estimatedCostUsd: number;
  targetCount: number;
  segmented: boolean;
  segmentTotal: number;
  segmentLabels: string[];
  provider: "unipile";
}> {
  if (!isUnipileConfigured()) {
    throw new Error("Unipile is not configured (UNIPILE_DSN / UNIPILE_API_KEY).");
  }

  const salesNavUrl = opts.salesNavUrl.trim();
  if (!isSalesNavSearchUrl(salesNavUrl)) {
    throw new Error(
      "Provide a Sales Navigator people-search URL (linkedin.com/sales/search/people…)."
    );
  }

  const unipileAccountId = await requireLiveLinkedInUnipileAccount(opts.coachId);
  await supersedeRunningSalesNavImports({ coachId: opts.coachId });

  const requestedTakePages = normalizeRequestedTakePages(opts.takePages);
  const targetCount = salesNavLeadTarget(requestedTakePages);
  const segments = planSalesNavImportSegments({
    salesNavUrl,
    targetLeadCount: targetCount,
  });
  const segmented = segments.length > 1;
  const segmentPlan = segments.map((seg, idx) =>
    idx === 0 ? { ...seg, status: "running" as const } : seg
  );
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .insert({
      coach_id: opts.coachId,
      sales_nav_url: salesNavUrl,
      name: opts.name?.trim() || null,
      take_pages: requestedTakePages,
      requested_take_pages: requestedTakePages,
      scraped_count: 0,
      progress_count: 0,
      cache_inserted: 0,
      cache_updated: 0,
      cache_skipped: 0,
      saved_to_list: false,
      list_id: opts.listId?.trim() || null,
      save_list_id: opts.saveListId?.trim() || null,
      profile_scraper_mode: "Unipile",
      estimated_cost_usd: 0,
      status: "running",
      provider: "unipile",
      unipile_account_id: unipileAccountId,
      unipile_cursor: null,
      apify_run_id: null,
      apify_dataset_id: null,
      lead_snapshot: [],
      started_at: now,
      segmented,
      segment_index: 0,
      segment_total: segments.length,
      segment_plan: segmentPlan,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Could not create Unipile import job.");
  }

  return {
    jobId: data.id as string,
    takePages: requestedTakePages,
    requestedTakePages,
    estimatedCostUsd: 0,
    targetCount,
    segmented,
    segmentTotal: segments.length,
    segmentLabels: segments.map((s) => s.label),
    provider: "unipile",
  };
}

export async function syncUnipileSalesNavImportJob(
  job: SalesNavImportJobRow
): Promise<SalesNavImportJobRow> {
  if (job.status === "succeeded" || job.status === "failed") {
    return job;
  }

  const existing = syncInFlight.get(job.id);
  if (existing) return existing;

  const promise = syncUnipileSalesNavImportJobInner(job).finally(() => {
    if (syncInFlight.get(job.id) === promise) syncInFlight.delete(job.id);
  });
  syncInFlight.set(job.id, promise);
  return promise;
}

async function syncUnipileSalesNavImportJobInner(
  job: SalesNavImportJobRow
): Promise<SalesNavImportJobRow> {

  const accountId = job.unipile_account_id?.trim();
  if (!accountId) {
    return markFailed(
      job.id,
      job.started_at,
      job.created_at,
      "Missing Unipile account id."
    );
  }

  const pages = requestedPagesForJob(job);
  const pageTarget = salesNavLeadTarget(pages);
  const globalCap = salesNavGlobalLeadCapFromPages(pages);
  const importAll = globalCap == null;
  type Snapshot = ReturnType<typeof toSalesNavImportLeadSnapshot>;
  let snapshot: Snapshot[] = Array.isArray(job.lead_snapshot)
    ? (job.lead_snapshot as Snapshot[])
    : [];
  let cursor = job.unipile_cursor;
  let cacheInserted = job.cache_inserted;
  let cacheUpdated = job.cache_updated;
  let cacheSkipped = job.cache_skipped;
  let segmentIndex = job.segment_index ?? 0;
  let segmentPlan = (job.segment_plan ?? []).map((s) => ({ ...s }));
  let pagesUsed = 0;
  const tickStarted = Date.now();

  const finalizeNow = () =>
    finalizeJob(job, {
      snapshot,
      cacheInserted,
      cacheUpdated,
      cacheSkipped,
      segmentPlan,
      segmentIndex,
    });

  while (
    pagesUsed < PAGES_PER_SYNC &&
    Date.now() - tickStarted < TICK_BUDGET_MS
  ) {
    if (globalCap != null && snapshot.length >= globalCap) {
      return finalizeNow();
    }

    const current = segmentPlan[segmentIndex];
    const searchUrl = salesNavUrlForUnipile(
      current?.salesNavUrl?.trim() || job.sales_nav_url?.trim() || ""
    );
    if (!isSalesNavSearchUrl(searchUrl)) {
      return markFailed(
        job.id,
        job.started_at,
        job.created_at,
        "Missing Sales Navigator search URL."
      );
    }

    const segmentScraped = current?.scrapedCount ?? 0;
    const scrapedCap = segmentScrapedCap({
      searchTotalCount: current?.searchTotalCount,
      pageTarget,
      importAll,
    });
    if (segmentScraped >= scrapedCap) {
      if (segmentPlan[segmentIndex]) {
        segmentPlan[segmentIndex] = {
          ...segmentPlan[segmentIndex],
          status: "succeeded",
          errorMessage: null,
        };
      }
      const advanced = advanceSegment(segmentPlan, segmentIndex);
      if (!advanced) {
        return finalizeJob(job, {
          snapshot,
          cacheInserted,
          cacheUpdated,
          cacheSkipped,
          segmentPlan,
          segmentIndex,
        });
      }
      segmentPlan = advanced.plan;
      segmentIndex = advanced.index;
      cursor = null;
      await persistProgress(job, {
        snapshot,
        cursor: null,
        cacheInserted,
        cacheUpdated,
        cacheSkipped,
        segmentPlan,
        segmentIndex,
        done: false,
      });
      continue;
    }

    if (pagesUsed > 0) await sleep(PAGE_DELAY_MS);
    pagesUsed += 1;

    const remaining = Math.min(
      scrapedCap - segmentScraped,
      globalCap != null
        ? Math.max(0, globalCap - snapshot.length)
        : Number.POSITIVE_INFINITY
    );
    if (remaining <= 0) {
      return finalizeNow();
    }
    const isSegmentStart = !cursor && segmentScraped === 0;
    const probeForCap =
      isSegmentStart &&
      current != null &&
      remaining >= SALES_NAV_EXTRACT_CAP &&
      shouldProbeSalesNavExtractCap(current);
    const limit = Math.min(UNIPILE_PAGE_SIZE, Math.max(1, remaining));

    const res = await linkedInSearch({
      account_id: accountId,
      ...(cursor ? { cursor } : { url: searchUrl }),
      limit,
      timeoutMs: SEARCH_TIMEOUT_MS,
    });

    if (!res.ok) {
      if (isRetryableUnipileSearch(res)) {
        // Don't write — a stale overlapping tick used to persist old snapshot
        // and rewind a job that had already moved on.
        return (await loadImportJob(job.id)) ?? job;
      }
      const message = unipileLinkedInAccountError(res);
      return markFailed(job.id, job.started_at, job.created_at, message);
    }

    if (probeForCap && current) {
      const total = searchTotalCount(res.data);
      if (total != null && total >= SALES_NAV_EXTRACT_CAP) {
        const children = subSplitOverExtractCap(current);
        if (children && children.length > 1) {
          segmentPlan = spliceSegmentPlan(
            segmentPlan,
            segmentIndex,
            children
          );
          cursor = null;
          await persistProgress(job, {
            snapshot,
            cursor: null,
            cacheInserted,
            cacheUpdated,
            cacheSkipped,
            segmentPlan,
            segmentIndex,
            done: false,
          });
          continue;
        }
      }
    }

    const items = (res.data?.items ?? [])
      .map(mapUnipileSearchItem)
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .slice(0, remaining);

    const totalFromProvider = searchTotalCount(res.data);
    if (
      totalFromProvider != null &&
      segmentPlan[segmentIndex] &&
      segmentPlan[segmentIndex].searchTotalCount == null
    ) {
      segmentPlan[segmentIndex] = {
        ...segmentPlan[segmentIndex],
        searchTotalCount: totalFromProvider,
      };
    }

    const snapshotBefore = snapshot.length;
    if (items.length > 0) {
      const cache = await upsertSalesNavLeadsToCache({
        leads: items,
        salesNavUrl: searchUrl,
      });
      cacheInserted += cache.inserted;
      cacheUpdated += cache.updated;
      cacheSkipped += cache.skipped;
      snapshot = mergeSalesNavLeadSnapshots(snapshot, items);
      if (segmentPlan[segmentIndex]) {
        segmentPlan[segmentIndex] = {
          ...segmentPlan[segmentIndex],
          scrapedCount:
            (segmentPlan[segmentIndex].scrapedCount ?? 0) + items.length,
          cacheInserted:
            (segmentPlan[segmentIndex].cacheInserted ?? 0) + cache.inserted,
          cacheUpdated:
            (segmentPlan[segmentIndex].cacheUpdated ?? 0) + cache.updated,
          status: "running",
          errorMessage: null,
        };
      }
    }
    const newUniqueCount = Math.max(0, snapshot.length - snapshotBefore);
    const scrapedNow = segmentPlan[segmentIndex]?.scrapedCount ?? 0;
    const zeroUniquePages =
      items.length > 0 && newUniqueCount === 0
        ? (segmentPlan[segmentIndex]?.zeroUniquePages ?? 0) + 1
        : 0;
    if (segmentPlan[segmentIndex]) {
      segmentPlan[segmentIndex] = {
        ...segmentPlan[segmentIndex],
        zeroUniquePages,
      };
    }

    if (globalCap != null && snapshot.length >= globalCap) {
      if (segmentPlan[segmentIndex]) {
        segmentPlan[segmentIndex] = {
          ...segmentPlan[segmentIndex],
          status: "succeeded",
          errorMessage: null,
        };
      }
      return finalizeNow();
    }

    const scrapedCapAfter = segmentScrapedCap({
      searchTotalCount: segmentPlan[segmentIndex]?.searchTotalCount,
      pageTarget,
      importAll,
    });
    const providerCursor = nextCursorFromSearch(res.data);
    const stalledCursor = Boolean(
      providerCursor && cursor && providerCursor === cursor
    );
    const moreRemain = scrapedNow < scrapedCapAfter;
    const nextCursor =
      moreRemain && items.length > 0
        ? nextUnipileUrlSearchCursor({
            accountId,
            url: searchUrl,
            start: scrapedNow,
            limit: UNIPILE_PAGE_SIZE,
            providerCursor,
          })
        : providerCursor;
    const segmentDone = shouldFinishUnipileSegment({
      scrapedCount: scrapedNow,
      scrapedCap: scrapedCapAfter,
      nextCursor,
      stalledCursor,
      itemsLength: items.length,
      newUniqueCount,
      duplicatePages: zeroUniquePages,
    });

    if (segmentDone) {
      if (segmentPlan[segmentIndex]) {
        segmentPlan[segmentIndex] = {
          ...segmentPlan[segmentIndex],
          status: "succeeded",
          errorMessage: null,
        };
      }
      const advanced = advanceSegment(segmentPlan, segmentIndex);
      if (!advanced) {
        return finalizeJob(job, {
          snapshot,
          cacheInserted,
          cacheUpdated,
          cacheSkipped,
          segmentPlan,
          segmentIndex,
        });
      }
      segmentPlan = advanced.plan;
      segmentIndex = advanced.index;
      cursor = null;
      await persistProgress(job, {
        snapshot,
        cursor: null,
        cacheInserted,
        cacheUpdated,
        cacheSkipped,
        segmentPlan,
        segmentIndex,
        done: false,
      });
      continue;
    }

    cursor = nextCursor;
    await persistProgress(job, {
      snapshot,
      cursor,
      cacheInserted,
      cacheUpdated,
      cacheSkipped,
      segmentPlan,
      segmentIndex,
      done: false,
      reload: false,
    });
  }

  return persistProgress(job, {
    snapshot,
    cursor,
    cacheInserted,
    cacheUpdated,
    cacheSkipped,
    segmentPlan,
    segmentIndex,
    done: false,
  });
}

function advanceSegment(
  plan: SalesNavImportSegmentPlan[],
  index: number
): { plan: SalesNavImportSegmentPlan[]; index: number } | null {
  const nextIndex = index + 1;
  if (nextIndex >= plan.length) return null;
  const nextPlan = plan.map((seg, idx) =>
    idx === nextIndex ? { ...seg, status: "running" as const, errorMessage: null } : seg
  );
  return { plan: nextPlan, index: nextIndex };
}

async function persistProgress(
  job: SalesNavImportJobRow,
  opts: {
    snapshot: ReturnType<typeof toSalesNavImportLeadSnapshot>[];
    cursor: string | null;
    cacheInserted: number;
    cacheUpdated: number;
    cacheSkipped: number;
    segmentPlan: SalesNavImportSegmentPlan[];
    segmentIndex: number;
    done: boolean;
    reload?: boolean;
  }
): Promise<SalesNavImportJobRow> {
  const { error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .update({
      status: opts.done ? "succeeded" : "running",
      unipile_cursor: opts.cursor,
      scraped_count: opts.snapshot.length,
      progress_count: opts.snapshot.length,
      cache_inserted: opts.cacheInserted,
      cache_updated: opts.cacheUpdated,
      cache_skipped: opts.cacheSkipped,
      lead_snapshot: opts.snapshot,
      segment_plan: opts.segmentPlan.length ? opts.segmentPlan : job.segment_plan,
      segment_index: opts.segmentIndex,
      segmented: opts.segmentPlan.length > 1,
      segment_total: opts.segmentPlan.length || job.segment_total,
      error_message: null,
      ...(opts.done
        ? {
            finished_at: new Date().toISOString(),
            duration_ms: Number.isFinite(
              Date.parse(job.started_at || job.created_at)
            )
              ? Math.max(
                  0,
                  Date.now() - Date.parse(job.started_at || job.created_at)
                )
              : null,
          }
        : {}),
    })
    .eq("id", job.id)
    .in("status", ["pending", "running"]);

  if (error) {
    return markFailed(job.id, job.started_at, job.created_at, error.message);
  }

  const listId = job.list_id?.trim() || null;
  const saveListId = job.save_list_id?.trim() || null;
  /** Only write people into pool/list tabs when the job finishes — mid-run
   * flushes were slow and made the Pool UI flicker if it reloaded. */
  if (opts.done && (listId || saveListId)) {
    try {
      if (listId) {
        await flushSalesNavSnapshotToList({
          coachId: job.coach_id,
          listId,
          kind: "pool",
          snapshot: opts.snapshot,
        });
      }
      if (saveListId) {
        await flushSalesNavSnapshotToList({
          coachId: job.coach_id,
          listId: saveListId,
          kind: "audience",
          snapshot: opts.snapshot,
        });
      }
      await supabaseAdmin
        .from("sales_nav_import_runs")
        .update({ saved_to_list: true })
        .eq("id", job.id);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not add imported people to the pool.";
      return markFailed(job.id, job.started_at, job.created_at, message);
    }
  }

  if (opts.reload === false) return job;
  return (await loadImportJob(job.id)) ?? job;
}

async function finalizeJob(
  job: SalesNavImportJobRow,
  opts: {
    snapshot: ReturnType<typeof toSalesNavImportLeadSnapshot>[];
    cacheInserted: number;
    cacheUpdated: number;
    cacheSkipped: number;
    segmentPlan: SalesNavImportSegmentPlan[];
    segmentIndex: number;
  }
): Promise<SalesNavImportJobRow> {
  return persistProgress(job, {
    ...opts,
    cursor: null,
    done: true,
  });
}

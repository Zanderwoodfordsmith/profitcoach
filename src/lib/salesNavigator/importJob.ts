/**
 * Background Sales Nav import jobs backed by sales_nav_import_runs + Apify .start().
 * Segmented imports split by team size (and years at company when targeting 2,500).
 */

import {
  SalesNavScrapeError,
  abortApifyRun,
  fetchSalesNavSearchDataset,
  getApifyRunState,
  startSalesNavSearch,
  type SalesNavImportedLead,
} from "@/lib/apify/salesNavigatorSearch";
import { estimateSalesNavShortCostUsd } from "@/lib/salesNavigator/apifyCost";
import { toSalesNavImportLeadSnapshot } from "@/lib/salesNavigator/importLeadSnapshot";
import {
  planSalesNavImportSegments,
  type SalesNavImportSegmentPlan,
} from "@/lib/salesNavigator/importSegments";
import {
  apifyTakePagesForRequest,
  normalizeRequestedTakePages,
  salesNavLeadTarget,
} from "@/lib/salesNavigator/importSizing";
import { upsertSalesNavLeadsToCache } from "@/lib/salesNavigator/upsertSalesNavLeadsToCache";
import { getSalesNavSessionCookie } from "@/lib/salesNavigator/sessionStore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SalesNavImportJobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export type SalesNavImportJobRow = {
  id: string;
  coach_id: string;
  status: SalesNavImportJobStatus;
  name: string | null;
  sales_nav_url: string | null;
  take_pages: number | null;
  requested_take_pages: number | null;
  scraped_count: number;
  progress_count: number;
  cache_inserted: number;
  cache_updated: number;
  cache_skipped: number;
  estimated_cost_usd: number | string | null;
  duration_ms: number | null;
  error_message: string | null;
  apify_run_id: string | null;
  apify_dataset_id: string | null;
  lead_snapshot: unknown;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  segmented: boolean;
  segment_index: number;
  segment_total: number;
  segment_plan: SalesNavImportSegmentPlan[] | null;
};

const JOB_SELECT =
  "id, coach_id, status, name, sales_nav_url, take_pages, requested_take_pages, scraped_count, progress_count, cache_inserted, cache_updated, cache_skipped, estimated_cost_usd, duration_ms, error_message, apify_run_id, apify_dataset_id, lead_snapshot, started_at, finished_at, created_at, segmented, segment_index, segment_total, segment_plan";

const TERMINAL_APIFY = new Set([
  "SUCCEEDED",
  "FAILED",
  "ABORTED",
  "TIMED-OUT",
]);

function asStatus(v: unknown): SalesNavImportJobStatus {
  if (
    v === "pending" ||
    v === "running" ||
    v === "succeeded" ||
    v === "failed"
  ) {
    return v;
  }
  return "succeeded";
}

function parseSegmentPlan(value: unknown): SalesNavImportSegmentPlan[] | null {
  if (!Array.isArray(value)) return null;
  const out: SalesNavImportSegmentPlan[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.salesNavUrl !== "string" || !r.salesNavUrl.trim()) continue;
    out.push({
      id: typeof r.id === "string" ? r.id : String(out.length),
      label: typeof r.label === "string" ? r.label : `Segment ${out.length + 1}`,
      salesNavUrl: r.salesNavUrl,
      teamSize: typeof r.teamSize === "string" ? r.teamSize : null,
      yearsAtCompany:
        r.yearsAtCompany === "1" ||
        r.yearsAtCompany === "2" ||
        r.yearsAtCompany === "3" ||
        r.yearsAtCompany === "4" ||
        r.yearsAtCompany === "5"
          ? r.yearsAtCompany
          : null,
      status:
        r.status === "pending" ||
        r.status === "running" ||
        r.status === "succeeded" ||
        r.status === "failed" ||
        r.status === "skipped"
          ? r.status
          : "pending",
      scrapedCount: Number(r.scrapedCount ?? 0),
      cacheInserted: Number(r.cacheInserted ?? 0),
      cacheUpdated: Number(r.cacheUpdated ?? 0),
      errorMessage:
        typeof r.errorMessage === "string" ? r.errorMessage : null,
    });
  }
  return out.length > 0 ? out : null;
}

export function requestedPagesForJob(job: {
  requested_take_pages?: number | null;
  take_pages?: number | null;
}): number {
  if (
    typeof job.requested_take_pages === "number" &&
    Number.isFinite(job.requested_take_pages) &&
    job.requested_take_pages > 0
  ) {
    return normalizeRequestedTakePages(job.requested_take_pages);
  }
  return normalizeRequestedTakePages(job.take_pages ?? 1);
}

export function targetCountForJob(job: {
  requested_take_pages?: number | null;
  take_pages?: number | null;
}): number {
  return salesNavLeadTarget(requestedPagesForJob(job));
}

function activeSegmentUrl(job: SalesNavImportJobRow): string | null {
  if (!job.segmented || !job.segment_plan?.length) {
    return job.sales_nav_url;
  }
  const seg = job.segment_plan[job.segment_index];
  return seg?.salesNavUrl ?? job.sales_nav_url;
}

function mergeSnapshots(
  existing: SalesNavImportLeadSnapshot[],
  incoming: SalesNavImportedLead[]
): SalesNavImportLeadSnapshot[] {
  const byKey = new Map<string, SalesNavImportLeadSnapshot>();
  for (const row of existing) {
    const key =
      row.linkedinUrl?.trim().toLowerCase() ||
      `${row.fullName ?? ""}|${row.company ?? ""}`.toLowerCase();
    if (key) byKey.set(key, row);
  }
  for (const lead of incoming) {
    const snap = toSalesNavImportLeadSnapshot(lead);
    const key =
      snap.linkedinUrl?.trim().toLowerCase() ||
      `${snap.fullName ?? ""}|${snap.company ?? ""}`.toLowerCase();
    if (key) byKey.set(key, snap);
  }
  return [...byKey.values()];
}

type SalesNavImportLeadSnapshot = ReturnType<typeof toSalesNavImportLeadSnapshot>;

async function markFailed(
  jobId: string,
  startedAt: string | null,
  message: string
): Promise<void> {
  const finishedAt = new Date().toISOString();
  const startMs = startedAt ? Date.parse(startedAt) : NaN;
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
}

async function startSegmentRun(opts: {
  jobId: string;
  segment: SalesNavImportSegmentPlan;
  segmentIndex: number;
  segmentPlan: SalesNavImportSegmentPlan[];
  requestedTakePages: number;
  segmented: boolean;
  cookie?: string;
  userAgent?: string;
}): Promise<{ apifyRunId: string; apifyDatasetId: string | null; takePages: number }> {
  const takePages = apifyTakePagesForRequest(opts.requestedTakePages, {
    skipOverfetch: opts.segmented,
  });
  const started = await startSalesNavSearch({
    salesNavUrl: opts.segment.salesNavUrl,
    cookie: opts.cookie,
    userAgent: opts.userAgent,
    takePages,
  });

  const nextPlan = opts.segmentPlan.map((seg, idx) =>
    idx === opts.segmentIndex
      ? { ...seg, status: "running" as const, errorMessage: null }
      : seg
  );

  const { error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .update({
      status: "running",
      apify_run_id: started.apifyRunId,
      apify_dataset_id: started.apifyDatasetId,
      take_pages: started.takePages,
      progress_count: 0,
      segment_index: opts.segmentIndex,
      segment_plan: nextPlan,
      error_message: null,
    })
    .eq("id", opts.jobId);

  if (error) throw new Error(error.message);

  return {
    apifyRunId: started.apifyRunId,
    apifyDatasetId: started.apifyDatasetId,
    takePages: started.takePages,
  };
}

async function finalizeSucceeded(opts: {
  job: SalesNavImportJobRow;
  datasetId: string;
}): Promise<SalesNavImportJobRow> {
  const takePages = Math.max(1, opts.job.take_pages ?? 1);
  let leads: SalesNavImportedLead[];
  try {
    leads = await fetchSalesNavSearchDataset({
      datasetId: opts.datasetId,
      takePages,
    });
  } catch (err) {
    const message =
      err instanceof SalesNavScrapeError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Import failed while reading Apify dataset.";
    await markFailed(opts.job.id, opts.job.started_at, message);
    const failed = await loadImportJob(opts.job.id);
    if (!failed) throw new Error(message);
    return failed;
  }

  const segmentUrl = activeSegmentUrl(opts.job);
  const cache = await upsertSalesNavLeadsToCache({
    leads,
    salesNavUrl: segmentUrl,
  });

  const requestedTakePages = requestedPagesForJob(opts.job);
  const segmentPlan = opts.job.segment_plan ?? [];
  const segmentIndex = opts.job.segment_index;
  const updatedPlan = segmentPlan.map((seg, idx) =>
    idx === segmentIndex
      ? {
          ...seg,
          status: "succeeded" as const,
          scrapedCount: leads.length,
          cacheInserted: cache.inserted,
          cacheUpdated: cache.updated,
          errorMessage: null,
        }
      : seg
  );

  const priorSnapshot = Array.isArray(opts.job.lead_snapshot)
    ? (opts.job.lead_snapshot as SalesNavImportLeadSnapshot[])
    : [];
  const mergedSnapshot = mergeSnapshots(priorSnapshot, leads);

  const totalInserted =
    (opts.job.cache_inserted ?? 0) + cache.inserted;
  const totalUpdated = (opts.job.cache_updated ?? 0) + cache.updated;
  const totalSkipped = (opts.job.cache_skipped ?? 0) + cache.skipped;
  const totalScraped = mergedSnapshot.length;

  const hasMoreSegments =
    opts.job.segmented &&
    segmentIndex + 1 < (opts.job.segment_total ?? updatedPlan.length);

  if (hasMoreSegments) {
    const nextIndex = segmentIndex + 1;
    const nextSegment = updatedPlan[nextIndex];
    if (!nextSegment) {
      throw new Error("Missing next import segment.");
    }

    const { error: midError } = await supabaseAdmin
      .from("sales_nav_import_runs")
      .update({
        status: "running",
        scraped_count: totalScraped,
        progress_count: totalScraped,
        cache_inserted: totalInserted,
        cache_updated: totalUpdated,
        cache_skipped: totalSkipped,
        lead_snapshot: mergedSnapshot,
        segment_plan: updatedPlan,
        segment_index: nextIndex,
        apify_run_id: null,
        apify_dataset_id: null,
        estimated_cost_usd: estimateSalesNavShortCostUsd(
          takePages * (nextIndex + 1)
        ),
      })
      .eq("id", opts.job.id)
      .in("status", ["pending", "running"]);

    if (midError) {
      throw new Error(midError.message || "Could not advance import segment.");
    }

    const session = await getSalesNavSessionCookie(opts.job.coach_id);
    await startSegmentRun({
      jobId: opts.job.id,
      segment: nextSegment,
      segmentIndex: nextIndex,
      segmentPlan: updatedPlan,
      requestedTakePages,
      segmented: true,
      cookie: session?.cookie,
      userAgent: session?.userAgent ?? undefined,
    });

    const refreshed = await loadImportJob(opts.job.id);
    if (!refreshed) throw new Error("Could not load import after segment advance.");
    return refreshed;
  }

  const finishedAt = new Date().toISOString();
  const startMs = opts.job.started_at
    ? Date.parse(opts.job.started_at)
    : Date.parse(opts.job.created_at);
  const durationMs = Number.isFinite(startMs)
    ? Math.max(0, Date.now() - startMs)
    : null;

  const segmentCount = Math.max(1, opts.job.segment_total ?? 1);
  const estimatedPages = takePages * segmentCount;

  const { data, error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .update({
      status: "succeeded",
      scraped_count: totalScraped,
      progress_count: totalScraped,
      cache_inserted: totalInserted,
      cache_updated: totalUpdated,
      cache_skipped: totalSkipped,
      lead_snapshot: mergedSnapshot,
      segment_plan: updatedPlan,
      apify_dataset_id: opts.datasetId,
      error_message: null,
      finished_at: finishedAt,
      duration_ms: durationMs,
      estimated_cost_usd: estimateSalesNavShortCostUsd(estimatedPages),
    })
    .eq("id", opts.job.id)
    .in("status", ["pending", "running"])
    .select(JOB_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Could not finalize import job.");
  }
  if (!data) {
    const existing = await loadImportJob(opts.job.id);
    if (existing) return existing;
    throw new Error("Could not finalize import job.");
  }

  return mapJobRow(data as Record<string, unknown>);
}

function mapJobRow(r: Record<string, unknown>): SalesNavImportJobRow {
  return {
    id: String(r.id),
    coach_id: String(r.coach_id),
    status: asStatus(r.status),
    name: typeof r.name === "string" ? r.name : null,
    sales_nav_url: typeof r.sales_nav_url === "string" ? r.sales_nav_url : null,
    take_pages:
      typeof r.take_pages === "number" && Number.isFinite(r.take_pages)
        ? r.take_pages
        : null,
    requested_take_pages:
      typeof r.requested_take_pages === "number" &&
      Number.isFinite(r.requested_take_pages)
        ? r.requested_take_pages
        : null,
    scraped_count: Number(r.scraped_count ?? 0),
    progress_count: Number(r.progress_count ?? 0),
    cache_inserted: Number(r.cache_inserted ?? 0),
    cache_updated: Number(r.cache_updated ?? 0),
    cache_skipped: Number(r.cache_skipped ?? 0),
    estimated_cost_usd: (r.estimated_cost_usd as number | string | null) ?? 0,
    duration_ms:
      typeof r.duration_ms === "number" && Number.isFinite(r.duration_ms)
        ? r.duration_ms
        : null,
    error_message:
      typeof r.error_message === "string" ? r.error_message : null,
    apify_run_id:
      typeof r.apify_run_id === "string" ? r.apify_run_id : null,
    apify_dataset_id:
      typeof r.apify_dataset_id === "string" ? r.apify_dataset_id : null,
    lead_snapshot: r.lead_snapshot,
    started_at: typeof r.started_at === "string" ? r.started_at : null,
    finished_at: typeof r.finished_at === "string" ? r.finished_at : null,
    created_at: String(r.created_at),
    segmented: Boolean(r.segmented),
    segment_index: Number(r.segment_index ?? 0),
    segment_total: Number(r.segment_total ?? 1),
    segment_plan: parseSegmentPlan(r.segment_plan),
  };
}

export async function createSalesNavImportJob(opts: {
  coachId: string;
  salesNavUrl: string;
  name?: string | null;
  cookie?: string;
  userAgent?: string;
  takePages?: number;
  autoSegment?: boolean;
}): Promise<{
  jobId: string;
  takePages: number;
  requestedTakePages: number;
  estimatedCostUsd: number;
  targetCount: number;
  segmented: boolean;
  segmentTotal: number;
  segmentLabels: string[];
}> {
  const requestedTakePages = normalizeRequestedTakePages(opts.takePages);
  const targetCount = salesNavLeadTarget(requestedTakePages);
  const segments = planSalesNavImportSegments({
    salesNavUrl: opts.salesNavUrl,
    targetLeadCount: targetCount,
    autoSegment: opts.autoSegment,
  });
  const segmented = segments.length > 1;
  const firstSegment = segments[0]!;

  const takePages = apifyTakePagesForRequest(requestedTakePages, {
    skipOverfetch: segmented,
  });

  const started = await startSalesNavSearch({
    salesNavUrl: firstSegment.salesNavUrl,
    cookie: opts.cookie,
    userAgent: opts.userAgent,
    takePages,
  });

  const estimatedCostUsd = estimateSalesNavShortCostUsd(
    takePages * segments.length
  );
  const now = new Date().toISOString();

  const segmentPlan = segments.map((seg, idx) =>
    idx === 0 ? { ...seg, status: "running" as const } : seg
  );

  const { data, error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .insert({
      coach_id: opts.coachId,
      sales_nav_url: opts.salesNavUrl.trim() || null,
      name: opts.name?.trim() || null,
      take_pages: started.takePages,
      requested_take_pages: requestedTakePages,
      scraped_count: 0,
      progress_count: 0,
      cache_inserted: 0,
      cache_updated: 0,
      cache_skipped: 0,
      saved_to_list: false,
      profile_scraper_mode: "Short",
      estimated_cost_usd: estimatedCostUsd,
      status: "running",
      apify_run_id: started.apifyRunId,
      apify_dataset_id: started.apifyDatasetId,
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
    throw new Error(error?.message || "Could not create import job row.");
  }

  return {
    jobId: data.id as string,
    takePages: started.takePages,
    requestedTakePages,
    estimatedCostUsd,
    targetCount,
    segmented,
    segmentTotal: segments.length,
    segmentLabels: segments.map((s) => s.label),
  };
}

export async function loadImportJob(
  jobId: string
): Promise<SalesNavImportJobRow | null> {
  const { data, error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .select(JOB_SELECT)
    .eq("id", jobId.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapJobRow(data as Record<string, unknown>);
}

/**
 * Poll Apify for a running job; finalize when the actor finishes.
 * Safe to call from client poll + cron.
 */
export async function syncSalesNavImportJob(
  jobId: string
): Promise<SalesNavImportJobRow> {
  const job = await loadImportJob(jobId);
  if (!job) {
    throw new Error("Import job not found.");
  }

  if (job.status === "succeeded" || job.status === "failed") {
    return job;
  }

  if (!job.apify_run_id) {
    await markFailed(job.id, job.started_at, "Missing Apify run id.");
    return (await loadImportJob(job.id))!;
  }

  let state;
  try {
    state = await getApifyRunState(job.apify_run_id);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not read Apify run status.";
    if (/not found/i.test(message)) {
      await markFailed(job.id, job.started_at, message);
      return (await loadImportJob(job.id))!;
    }
    return job;
  }

  const priorSnapshotCount = Array.isArray(job.lead_snapshot)
    ? job.lead_snapshot.length
    : 0;
  const progressCount = Math.max(
    job.progress_count,
    priorSnapshotCount + state.itemCount
  );

  const segmentTarget = targetCountForJob(job);

  if (
    job.segmented &&
    state.status === "RUNNING" &&
    state.itemCount >= segmentTarget &&
    segmentTarget > 0
  ) {
    try {
      await abortApifyRun(job.apify_run_id);
    } catch {
      // Best-effort — finalize on next poll if abort fails.
    }
  }

  const intentionalAbort =
    state.status === "ABORTED" &&
    job.segmented &&
    state.itemCount >= segmentTarget &&
    segmentTarget > 0;

  if (
    progressCount !== job.progress_count ||
    (state.datasetId && state.datasetId !== job.apify_dataset_id)
  ) {
    await supabaseAdmin
      .from("sales_nav_import_runs")
      .update({
        progress_count: progressCount,
        apify_dataset_id: state.datasetId ?? job.apify_dataset_id,
        status: "running",
      })
      .eq("id", job.id);
  }

  if (!TERMINAL_APIFY.has(state.status) && !intentionalAbort) {
    const refreshed = await loadImportJob(job.id);
    return (
      refreshed ?? { ...job, progress_count: progressCount, status: "running" }
    );
  }

  if (state.status !== "SUCCEEDED" && !intentionalAbort) {
    await markFailed(
      job.id,
      job.started_at,
      `Apify run ${state.status.toLowerCase()}.`
    );
    return (await loadImportJob(job.id))!;
  }

  const datasetId = state.datasetId ?? job.apify_dataset_id;
  if (!datasetId) {
    await markFailed(
      job.id,
      job.started_at,
      "Apify run succeeded without a dataset."
    );
    return (await loadImportJob(job.id))!;
  }

  return finalizeSucceeded({ job, datasetId });
}

/** Cron helper: advance all non-terminal jobs. */
export async function syncAllRunningSalesNavImportJobs(limit = 20): Promise<{
  checked: number;
  succeeded: number;
  failed: number;
  stillRunning: number;
}> {
  const { data, error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .select("id")
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  let succeeded = 0;
  let failed = 0;
  let stillRunning = 0;

  for (const row of data ?? []) {
    try {
      const job = await syncSalesNavImportJob(String(row.id));
      if (job.status === "succeeded") succeeded += 1;
      else if (job.status === "failed") failed += 1;
      else stillRunning += 1;
    } catch (err) {
      console.error(
        "syncSalesNavImportJob failed:",
        row.id,
        err instanceof Error ? err.message : err
      );
      stillRunning += 1;
    }
  }

  return {
    checked: (data ?? []).length,
    succeeded,
    failed,
    stillRunning,
  };
}

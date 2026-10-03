import {
  fetchMappedGoogleSearchResults,
  getApifyRunState,
  startGoogleSearch,
} from "@/lib/apify/googleSearch";
import {
  clampGoogleSearchMaxResults,
  estimateGoogleSearchCostUsd,
  GOOGLE_SEARCH_RESULTS_PER_PAGE,
} from "@/lib/googleSearch/cost";
import { flushGoogleSearchResultsToPool } from "@/lib/googleSearch/flushResultsToPool";
import {
  buildGoogleSearchQueries,
  joinGoogleSearchTerms,
  parseGoogleSearchTerms,
} from "@/lib/googleSearch/searchTerms";
import {
  isLeadListUuid,
  MAX_LIST_ITEMS_TOTAL,
  MAX_POOL_ITEMS_TOTAL,
} from "@/lib/leadLists/audienceLists";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type GoogleSearchImportStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export type GoogleSearchImportJob = {
  id: string;
  coach_id: string;
  list_id: string | null;
  save_list_id: string | null;
  status: GoogleSearchImportStatus;
  search_term: string | null;
  location_query: string | null;
  country_code: string | null;
  max_results: number | null;
  find_people: boolean;
  apify_run_id: string | null;
  apify_dataset_id: string | null;
  scraped_count: number;
  progress_count: number;
  added_count: number;
  skipped_count: number;
  people_found: number;
  estimated_cost_usd: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

const JOB_SELECT =
  "id, coach_id, list_id, save_list_id, status, search_term, location_query, country_code, max_results, find_people, apify_run_id, apify_dataset_id, scraped_count, progress_count, added_count, skipped_count, people_found, estimated_cost_usd, error_message, started_at, finished_at, created_at";

const TERMINAL_APIFY = new Set([
  "SUCCEEDED",
  "FAILED",
  "ABORTED",
  "TIMED-OUT",
]);

function mapJob(row: Record<string, unknown>): GoogleSearchImportJob {
  const status =
    row.status === "pending" ||
    row.status === "running" ||
    row.status === "succeeded" ||
    row.status === "failed"
      ? row.status
      : "failed";
  return {
    id: String(row.id),
    coach_id: String(row.coach_id),
    list_id: typeof row.list_id === "string" ? row.list_id : null,
    save_list_id:
      typeof row.save_list_id === "string" ? row.save_list_id : null,
    status,
    search_term: typeof row.search_term === "string" ? row.search_term : null,
    location_query:
      typeof row.location_query === "string" ? row.location_query : null,
    country_code:
      typeof row.country_code === "string" ? row.country_code : null,
    max_results:
      typeof row.max_results === "number"
        ? row.max_results
        : Number(row.max_results ?? 0) || null,
    find_people: row.find_people !== false,
    apify_run_id:
      typeof row.apify_run_id === "string" ? row.apify_run_id : null,
    apify_dataset_id:
      typeof row.apify_dataset_id === "string" ? row.apify_dataset_id : null,
    scraped_count: Number(row.scraped_count ?? 0),
    progress_count: Number(row.progress_count ?? 0),
    added_count: Number(row.added_count ?? 0),
    skipped_count: Number(row.skipped_count ?? 0),
    people_found: Number(row.people_found ?? 0),
    estimated_cost_usd: Number(row.estimated_cost_usd ?? 0),
    error_message:
      typeof row.error_message === "string" ? row.error_message : null,
    started_at: typeof row.started_at === "string" ? row.started_at : null,
    finished_at: typeof row.finished_at === "string" ? row.finished_at : null,
    created_at: String(row.created_at),
  };
}

export async function loadGoogleSearchImportJob(
  id: string
): Promise<GoogleSearchImportJob | null> {
  if (!isLeadListUuid(id)) return null;
  const { data } = await supabaseAdmin
    .from("google_search_import_runs")
    .select(JOB_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return mapJob(data as Record<string, unknown>);
}

async function assertNoRunningJob(coachId: string) {
  const { data } = await supabaseAdmin
    .from("google_search_import_runs")
    .select("id")
    .eq("coach_id", coachId)
    .in("status", ["pending", "running"])
    .limit(1)
    .maybeSingle();
  if (data?.id) {
    throw new Error(
      "A Google Search import is already running. Wait for it to finish."
    );
  }
}

export async function createGoogleSearchJob(opts: {
  coachId: string;
  listId: string;
  saveListId?: string | null;
  searchTerms: string[];
  locationQuery: string;
  countryCode?: string | null;
  maxResults: number;
  findPeople: boolean;
}): Promise<{ jobId: string; targetCount: number; estimatedCostUsd: number }> {
  await assertNoRunningJob(opts.coachId);
  const searchTerms = parseGoogleSearchTerms(opts.searchTerms);
  if (!searchTerms.length) {
    throw new Error("Enter a search like plumbers or dental practices.");
  }
  const maxResults = clampGoogleSearchMaxResults(opts.maxResults);
  const findPeople = opts.findPeople !== false;
  const started = await startGoogleSearch({
    searchTerms,
    locationQuery: opts.locationQuery,
    countryCode: opts.countryCode,
    maxResults,
    findPeople,
  });
  const estimatedCostUsd = estimateGoogleSearchCostUsd({
    maxResults,
    queryCount: buildGoogleSearchQueries(searchTerms, opts.locationQuery).length,
    findPeople,
  });
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("google_search_import_runs")
    .insert({
      coach_id: opts.coachId,
      list_id: opts.listId,
      save_list_id: opts.saveListId?.trim() || null,
      status: "running",
      search_term: joinGoogleSearchTerms(searchTerms),
      location_query: opts.locationQuery.trim(),
      country_code: opts.countryCode?.trim() || null,
      max_results: maxResults,
      find_people: findPeople,
      apify_run_id: started.apifyRunId,
      apify_dataset_id: started.apifyDatasetId,
      estimated_cost_usd: estimatedCostUsd,
      started_at: now,
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error(error?.message || "Could not create Google Search import.");
  }
  return {
    jobId: data.id as string,
    targetCount: maxResults,
    estimatedCostUsd,
  };
}

async function markFailed(job: GoogleSearchImportJob, message: string) {
  await supabaseAdmin
    .from("google_search_import_runs")
    .update({
      status: "failed",
      error_message: message.slice(0, 500),
      finished_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "running");
}

async function finishRunningJob(
  jobId: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("google_search_import_runs")
    .update(patch)
    .eq("id", jobId)
    .eq("status", "running")
    .select("id")
    .maybeSingle();
  return Boolean(data?.id);
}

function resultsSeen(pageCount: number, maxResults: number): number {
  return Math.min(
    maxResults,
    Math.max(0, pageCount) * GOOGLE_SEARCH_RESULTS_PER_PAGE
  );
}

export async function syncGoogleSearchImportJob(
  jobId: string
): Promise<GoogleSearchImportJob> {
  const job = await loadGoogleSearchImportJob(jobId);
  if (!job) throw new Error("Import not found.");
  if (job.status === "succeeded" || job.status === "failed") return job;
  if (!job.apify_run_id) {
    await markFailed(job, "Apify run id missing.");
    return (await loadGoogleSearchImportJob(job.id))!;
  }

  const state = await getApifyRunState(job.apify_run_id);
  const maxResults = job.max_results ?? 100;
  const progressCount = Math.max(
    job.progress_count,
    resultsSeen(state.itemCount, maxResults)
  );
  if (state.datasetId && state.datasetId !== job.apify_dataset_id) {
    await supabaseAdmin
      .from("google_search_import_runs")
      .update({
        apify_dataset_id: state.datasetId,
        progress_count: progressCount,
        scraped_count: progressCount,
      })
      .eq("id", job.id);
  } else if (progressCount !== job.progress_count) {
    await supabaseAdmin
      .from("google_search_import_runs")
      .update({
        progress_count: progressCount,
        scraped_count: progressCount,
      })
      .eq("id", job.id);
  }

  if (!TERMINAL_APIFY.has(state.status)) {
    return (
      (await loadGoogleSearchImportJob(job.id)) ?? {
        ...job,
        progress_count: progressCount,
      }
    );
  }
  if (state.status !== "SUCCEEDED") {
    await markFailed(job, `Apify run ${state.status.toLowerCase()}.`);
    return (await loadGoogleSearchImportJob(job.id))!;
  }
  const datasetId = state.datasetId ?? job.apify_dataset_id;
  if (!datasetId) {
    await markFailed(job, "Apify run succeeded without a dataset.");
    return (await loadGoogleSearchImportJob(job.id))!;
  }

  try {
    const results = await fetchMappedGoogleSearchResults({
      datasetId,
      maxItems: Math.max(state.itemCount, 1) + 20,
      maxResults,
    });
    if (!job.list_id) throw new Error("Import has no pool list.");
    const flushed = await flushGoogleSearchResultsToPool({
      coachId: job.coach_id,
      listId: job.list_id,
      results,
      cap: MAX_POOL_ITEMS_TOTAL,
    });
    if (job.save_list_id) {
      await flushGoogleSearchResultsToPool({
        coachId: job.coach_id,
        listId: job.save_list_id,
        results,
        cap: MAX_LIST_ITEMS_TOTAL,
      });
    }
    await finishRunningJob(job.id, {
      status: "succeeded",
      scraped_count: results.length,
      progress_count: results.length,
      added_count: flushed.added,
      skipped_count: flushed.skipped,
      people_found: flushed.peopleFound,
      finished_at: new Date().toISOString(),
      error_message: null,
    });
  } catch (err) {
    await markFailed(
      job,
      err instanceof Error ? err.message : "Could not save Google Search results."
    );
  }
  return (await loadGoogleSearchImportJob(job.id))!;
}

export async function syncAllRunningGoogleSearchImportJobs(
  limit = 10
): Promise<{ checked: number; succeeded: number; failed: number }> {
  const { data } = await supabaseAdmin
    .from("google_search_import_runs")
    .select("id")
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: true })
    .limit(limit);
  const ids = (data ?? []).map((row) => row.id as string);
  let succeeded = 0;
  let failed = 0;
  for (const id of ids) {
    const next = await syncGoogleSearchImportJob(id);
    if (next.status === "succeeded") succeeded += 1;
    if (next.status === "failed") failed += 1;
  }
  return { checked: ids.length, succeeded, failed };
}

export function googleSearchImportJobPayload(job: GoogleSearchImportJob) {
  const target = job.max_results ?? 0;
  return {
    jobId: job.id,
    status: job.status,
    kind: "search" as const,
    progressCount: job.progress_count,
    targetCount: target,
    scrapedCount: job.scraped_count,
    added: job.added_count,
    skipped: job.skipped_count,
    peopleFound: job.people_found,
    estimatedCostUsd: job.estimated_cost_usd,
    error: job.error_message,
    findPeople: job.find_people,
    saveListId: job.save_list_id,
    startedAt: job.started_at,
    phase:
      job.status === "running" && target > 0 && job.progress_count >= target
        ? ("finalizing" as const)
        : ("scraping" as const),
  };
}

import {
  fetchMappedGoogleMapsPlaces,
  getApifyRunState,
  startGoogleMapsFindPerson,
  startGoogleMapsSearch,
} from "@/lib/apify/googleMapsPlaces";
import { applyGoogleMapsFindPersonResults } from "@/lib/googleMaps/applyFindPerson";
import {
  clampGoogleMapsMaxPlaces,
  estimateGoogleMapsFindPersonCostUsd,
  estimateGoogleMapsSearchCostUsd,
  GOOGLE_MAPS_FIND_PERSON_MAX,
} from "@/lib/googleMaps/cost";
import { flushGoogleMapsPlacesToPool } from "@/lib/googleMaps/flushPlacesToPool";
import { limitGoogleMapsPlaces } from "@/lib/googleMaps/mapPlaceToPool";
import {
  joinGoogleMapsSearchTerms,
  parseGoogleMapsSearchTerms,
} from "@/lib/googleMaps/searchTerms";
import {
  isLeadListUuid,
  MAX_LIST_ITEMS_TOTAL,
  MAX_POOL_ITEMS_TOTAL,
} from "@/lib/leadLists/audienceLists";
import { normalizeGooglePlaceId } from "@/lib/pool/identity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type GoogleMapsImportKind = "search" | "find_person";
export type GoogleMapsImportStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export type GoogleMapsImportJob = {
  id: string;
  coach_id: string;
  list_id: string | null;
  save_list_id: string | null;
  kind: GoogleMapsImportKind;
  status: GoogleMapsImportStatus;
  search_term: string | null;
  location_query: string | null;
  max_places: number | null;
  find_people: boolean;
  skip_closed: boolean;
  scrape_contacts: boolean;
  place_ids: string[];
  item_ids: string[];
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
  "id, coach_id, list_id, save_list_id, kind, status, search_term, location_query, max_places, find_people, skip_closed, scrape_contacts, place_ids, item_ids, apify_run_id, apify_dataset_id, scraped_count, progress_count, added_count, skipped_count, people_found, estimated_cost_usd, error_message, started_at, finished_at, created_at";

const TERMINAL_APIFY = new Set([
  "SUCCEEDED",
  "FAILED",
  "ABORTED",
  "TIMED-OUT",
]);

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

function mapJob(row: Record<string, unknown>): GoogleMapsImportJob {
  const kind = row.kind === "find_person" ? "find_person" : "search";
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
    save_list_id: typeof row.save_list_id === "string" ? row.save_list_id : null,
    kind,
    status,
    search_term: typeof row.search_term === "string" ? row.search_term : null,
    location_query:
      typeof row.location_query === "string" ? row.location_query : null,
    max_places:
      typeof row.max_places === "number" ? row.max_places : Number(row.max_places ?? 0) || null,
    find_people: Boolean(row.find_people),
    skip_closed: row.skip_closed !== false,
    scrape_contacts: row.scrape_contacts !== false,
    place_ids: asStringArray(row.place_ids),
    item_ids: asStringArray(row.item_ids),
    apify_run_id: typeof row.apify_run_id === "string" ? row.apify_run_id : null,
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

export async function loadGoogleMapsImportJob(
  id: string
): Promise<GoogleMapsImportJob | null> {
  if (!isLeadListUuid(id)) return null;
  const { data } = await supabaseAdmin
    .from("google_maps_import_runs")
    .select(JOB_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return mapJob(data as Record<string, unknown>);
}

async function assertNoRunningJob(coachId: string) {
  const { data } = await supabaseAdmin
    .from("google_maps_import_runs")
    .select("id")
    .eq("coach_id", coachId)
    .in("status", ["pending", "running"])
    .limit(1)
    .maybeSingle();
  if (data?.id) {
    throw new Error("A Google Maps import is already running. Wait for it to finish.");
  }
}

async function insertRunningJob(row: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("google_maps_import_runs")
    .insert(row)
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error(error?.message || "Could not create Google Maps import.");
  }
  return data.id as string;
}

export async function createGoogleMapsSearchJob(opts: {
  coachId: string;
  listId: string;
  saveListId?: string | null;
  searchTerm?: string;
  searchTerms?: string[];
  location: string;
  countryCode?: string | null;
  stateLabel?: string | null;
  maxPlaces: number;
  findPeople: boolean;
}): Promise<{ jobId: string; targetCount: number; estimatedCostUsd: number }> {
  await assertNoRunningJob(opts.coachId);
  const searchTerms = parseGoogleMapsSearchTerms(
    opts.searchTerms ?? opts.searchTerm
  );
  if (!searchTerms.length) {
    throw new Error("Enter a search like plumbers or dental practices.");
  }
  const searchTerm = joinGoogleMapsSearchTerms(searchTerms);
  const maxPlaces = clampGoogleMapsMaxPlaces(opts.maxPlaces);
  const findPeople = Boolean(opts.findPeople);
  const started = await startGoogleMapsSearch({
    searchTerms,
    location: opts.location,
    countryCode: opts.countryCode,
    state: opts.stateLabel,
    maxPlaces,
    findPeople,
  });
  const estimatedCostUsd = estimateGoogleMapsSearchCostUsd({
    maxPlaces,
    findPeople,
  });
  const now = new Date().toISOString();
  const jobId = await insertRunningJob({
    coach_id: opts.coachId,
    list_id: opts.listId,
    save_list_id: opts.saveListId?.trim() || null,
    kind: "search",
    status: "running",
    search_term: searchTerm,
    location_query: opts.location.trim(),
    max_places: maxPlaces,
    find_people: findPeople,
    skip_closed: true,
    scrape_contacts: true,
    place_ids: [],
    item_ids: [],
    apify_run_id: started.apifyRunId,
    apify_dataset_id: started.apifyDatasetId,
    estimated_cost_usd: estimatedCostUsd,
    started_at: now,
  });
  return { jobId, targetCount: maxPlaces, estimatedCostUsd };
}

export async function createGoogleMapsFindPersonJob(opts: {
  coachId: string;
  listId: string;
  itemIds: string[];
}): Promise<{ jobId: string; targetCount: number; estimatedCostUsd: number }> {
  await assertNoRunningJob(opts.coachId);
  const ids = opts.itemIds
    .filter((id) => isLeadListUuid(id))
    .slice(0, GOOGLE_MAPS_FIND_PERSON_MAX);
  if (!ids.length) {
    throw new Error("Select businesses to find people for.");
  }

  const { data: items, error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("id, place_id, linkedin_url")
    .eq("coach_id", opts.coachId)
    .eq("list_id", opts.listId)
    .in("id", ids);
  if (error) throw new Error(error.message);

  const eligible = (items ?? []).filter((row) => {
    const placeId = normalizeGooglePlaceId(
      typeof row.place_id === "string" ? row.place_id : null
    );
    const hasPerson = Boolean(
      typeof row.linkedin_url === "string" &&
        row.linkedin_url.includes("/in/")
    );
    return Boolean(placeId) && !hasPerson;
  });
  const placeIds = eligible
    .map((row) =>
      normalizeGooglePlaceId(typeof row.place_id === "string" ? row.place_id : null)
    )
    .filter((id): id is string => Boolean(id));
  if (!placeIds.length) {
    throw new Error(
      "LinkedIn campaigns need a personal profile. None of those rows can be searched yet (no Google Place ID, or they already have LinkedIn)."
    );
  }

  const started = await startGoogleMapsFindPerson({ placeIds });
  const estimatedCostUsd = estimateGoogleMapsFindPersonCostUsd(placeIds.length);
  const now = new Date().toISOString();
  const jobId = await insertRunningJob({
    coach_id: opts.coachId,
    list_id: opts.listId,
    kind: "find_person",
    status: "running",
    find_people: true,
    skip_closed: false,
    scrape_contacts: false,
    max_places: placeIds.length,
    place_ids: placeIds,
    item_ids: eligible.map((row) => row.id),
    apify_run_id: started.apifyRunId,
    apify_dataset_id: started.apifyDatasetId,
    estimated_cost_usd: estimatedCostUsd,
    started_at: now,
  });
  return { jobId, targetCount: placeIds.length, estimatedCostUsd };
}

async function markFailed(job: GoogleMapsImportJob, message: string) {
  await supabaseAdmin
    .from("google_maps_import_runs")
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
    .from("google_maps_import_runs")
    .update(patch)
    .eq("id", jobId)
    .eq("status", "running")
    .select("id")
    .maybeSingle();
  return Boolean(data?.id);
}

export async function syncGoogleMapsImportJob(
  jobId: string
): Promise<GoogleMapsImportJob> {
  const job = await loadGoogleMapsImportJob(jobId);
  if (!job) throw new Error("Import not found.");
  if (job.status === "succeeded" || job.status === "failed") return job;
  if (!job.apify_run_id) {
    await markFailed(job, "Apify run id missing.");
    return (await loadGoogleMapsImportJob(job.id))!;
  }

  const state = await getApifyRunState(job.apify_run_id);
  const progressCount = Math.max(job.progress_count, state.itemCount);
  if (state.datasetId && state.datasetId !== job.apify_dataset_id) {
    await supabaseAdmin
      .from("google_maps_import_runs")
      .update({
        apify_dataset_id: state.datasetId,
        progress_count: progressCount,
        scraped_count: progressCount,
      })
      .eq("id", job.id);
  } else if (progressCount !== job.progress_count) {
    await supabaseAdmin
      .from("google_maps_import_runs")
      .update({
        progress_count: progressCount,
        scraped_count: progressCount,
      })
      .eq("id", job.id);
  }

  if (!TERMINAL_APIFY.has(state.status)) {
    return (await loadGoogleMapsImportJob(job.id)) ?? { ...job, progress_count: progressCount };
  }
  if (state.status !== "SUCCEEDED") {
    await markFailed(job, `Apify run ${state.status.toLowerCase()}.`);
    return (await loadGoogleMapsImportJob(job.id))!;
  }
  const datasetId = state.datasetId ?? job.apify_dataset_id;
  if (!datasetId) {
    await markFailed(job, "Apify run succeeded without a dataset.");
    return (await loadGoogleMapsImportJob(job.id))!;
  }

  try {
    const maxItems = Math.max(job.max_places ?? 100, progressCount) + 50;
    const mapped = await fetchMappedGoogleMapsPlaces({
      datasetId,
      maxItems,
    });
    const places =
      job.kind === "find_person"
        ? mapped
        : limitGoogleMapsPlaces(mapped, job.max_places ?? 100);
    if (!job.list_id) {
      throw new Error("Import has no pool list.");
    }
    if (job.kind === "find_person") {
      const applied = await applyGoogleMapsFindPersonResults({
        coachId: job.coach_id,
        listId: job.list_id,
        itemIds: job.item_ids,
        places,
      });
      await finishRunningJob(job.id, {
        status: "succeeded",
        scraped_count: places.length,
        progress_count: places.length,
        added_count: 0,
        skipped_count: Math.max(0, job.item_ids.length - applied.updated),
        people_found: applied.updated,
        finished_at: new Date().toISOString(),
        error_message: null,
      });
    } else {
      const flushed = await flushGoogleMapsPlacesToPool({
        coachId: job.coach_id,
        listId: job.list_id,
        places,
        cap: MAX_POOL_ITEMS_TOTAL,
      });
      if (job.save_list_id) {
        await flushGoogleMapsPlacesToPool({
          coachId: job.coach_id,
          listId: job.save_list_id,
          places,
          cap: MAX_LIST_ITEMS_TOTAL,
        });
      }
      await finishRunningJob(job.id, {
        status: "succeeded",
        scraped_count: places.length,
        progress_count: places.length,
        added_count: flushed.added,
        skipped_count: flushed.skipped,
        people_found: flushed.peopleFound,
        finished_at: new Date().toISOString(),
        error_message: null,
      });
    }
  } catch (err) {
    await markFailed(
      job,
      err instanceof Error ? err.message : "Could not save Google Maps results."
    );
  }
  return (await loadGoogleMapsImportJob(job.id))!;
}

export async function syncAllRunningGoogleMapsImportJobs(limit = 10): Promise<{
  checked: number;
  succeeded: number;
  failed: number;
}> {
  const { data } = await supabaseAdmin
    .from("google_maps_import_runs")
    .select("id")
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: true })
    .limit(limit);
  const ids = (data ?? []).map((row) => row.id as string);
  let succeeded = 0;
  let failed = 0;
  for (const id of ids) {
    const next = await syncGoogleMapsImportJob(id);
    if (next.status === "succeeded") succeeded += 1;
    if (next.status === "failed") failed += 1;
  }
  return { checked: ids.length, succeeded, failed };
}

export function googleMapsImportJobPayload(job: GoogleMapsImportJob) {
  return {
    jobId: job.id,
    status: job.status,
    kind: job.kind,
    progressCount: job.progress_count,
    targetCount: job.max_places ?? job.place_ids.length,
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
      job.status === "running" &&
      job.progress_count > 0 &&
      (job.max_places ?? 0) > 0 &&
      job.progress_count >= (job.max_places ?? 0)
        ? ("finalizing" as const)
        : ("scraping" as const),
  };
}

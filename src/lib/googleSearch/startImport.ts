import {
  createCoachAudienceList,
  defaultPoolImportListName,
  ensureCoachPool,
  MAX_LIST_ITEMS_TOTAL,
} from "@/lib/leadLists/audienceLists";
import {
  clampGoogleSearchMaxResults,
  estimateGoogleSearchCostUsd,
  formatGoogleSearchApproxDuration,
} from "@/lib/googleSearch/cost";
import { createGoogleSearchJob } from "@/lib/googleSearch/importJob";
import {
  buildGoogleSearchQueries,
  formatGoogleSearchLabel,
  joinGoogleSearchTerms,
  parseGoogleSearchTerms,
} from "@/lib/googleSearch/searchTerms";
import {
  resolveGoogleMapsLocation,
  type GoogleMapsLocationInput,
  type ResolvedGoogleMapsLocation,
} from "@/lib/googleMaps/location";

/**
 * Google Search pool import, shared by the import route and the AI agent.
 * Same place picker and owner lookup as Maps. Results come from Google Search.
 */

export type GoogleSearchImportRequest = GoogleMapsLocationInput & {
  searchTerm?: string;
  searchTerms?: string[];
  maxResults?: number;
  saveListName?: string;
};

export type GoogleSearchImportPlan = {
  searchTerms: string[];
  searchTerm: string;
  queries: string[];
  location: ResolvedGoogleMapsLocation;
  maxResults: number;
  saveListName: string;
  estimatedCostUsd: number;
  approxDuration: string;
};

export function planGoogleSearchImport(
  input: GoogleSearchImportRequest
): GoogleSearchImportPlan | { error: string } {
  const searchTerms = parseGoogleSearchTerms(
    input.searchTerms ?? input.searchTerm
  );
  if (!searchTerms.length) {
    return { error: "Enter a search like plumbers or dental practices." };
  }
  const location = resolveGoogleMapsLocation({
    city: input.city,
    countryCode: input.countryCode,
    countryName: input.countryName,
    stateCode: input.stateCode,
    location: input.location,
  });
  if ("error" in location) return { error: location.error };

  const maxResults = clampGoogleSearchMaxResults(input.maxResults);
  const queries = buildGoogleSearchQueries(searchTerms, location.locationQuery);
  const saveListName = (
    input.saveListName?.trim() ||
    `${defaultPoolImportListName("google_search")} · ${formatGoogleSearchLabel(searchTerms)}`
  ).slice(0, 120);

  return {
    searchTerms,
    searchTerm: joinGoogleSearchTerms(searchTerms),
    queries,
    location,
    maxResults,
    saveListName,
    estimatedCostUsd: estimateGoogleSearchCostUsd({
      maxResults,
      queryCount: queries.length,
      findPeople: true,
    }),
    approxDuration: formatGoogleSearchApproxDuration(maxResults),
  };
}

export async function startGoogleSearchImport(
  coachId: string,
  plan: GoogleSearchImportPlan
) {
  const pool = await ensureCoachPool(coachId);
  const saveList = await createCoachAudienceList({
    coachId,
    name: plan.saveListName,
    source: "google_search",
    filters: {
      from_pool_import: true,
      search_term: plan.searchTerm,
      search_terms: plan.searchTerms,
      queries: plan.queries,
      location: plan.location.locationQuery,
      country_code: plan.location.countryCode,
      state_code: plan.location.stateCode,
      max_results: plan.maxResults,
      list_cap: MAX_LIST_ITEMS_TOTAL,
    },
  });
  const job = await createGoogleSearchJob({
    coachId,
    listId: pool.id,
    saveListId: saveList.id,
    searchTerms: plan.searchTerms,
    locationQuery: plan.location.locationQuery,
    countryCode: plan.location.countryCode,
    maxResults: plan.maxResults,
    findPeople: true,
  });
  return {
    jobId: job.jobId,
    targetCount: job.targetCount,
    estimatedCostUsd: job.estimatedCostUsd,
    saveListId: saveList.id,
    saveListName: saveList.name,
  };
}

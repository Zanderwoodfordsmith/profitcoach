import {
  createCoachAudienceList,
  defaultPoolImportListName,
  ensureCoachPool,
  MAX_LIST_ITEMS_TOTAL,
} from "@/lib/leadLists/audienceLists";
import { createGoogleMapsSearchJob } from "@/lib/googleMaps/importJob";
import {
  clampGoogleMapsMaxPlaces,
  estimateGoogleMapsSearchCostUsd,
  formatGoogleMapsApproxDuration,
} from "@/lib/googleMaps/cost";
import {
  resolveGoogleMapsLocation,
  type GoogleMapsLocationInput,
  type ResolvedGoogleMapsLocation,
} from "@/lib/googleMaps/location";
import {
  formatGoogleMapsSearchLabel,
  joinGoogleMapsSearchTerms,
  parseGoogleMapsSearchTerms,
} from "@/lib/googleMaps/searchTerms";

/**
 * Google Maps pool import, shared by the import route and the AI agent.
 * plan validates and prices; start creates the list and the Apify job.
 */

export type GoogleMapsImportRequest = GoogleMapsLocationInput & {
  searchTerm?: string;
  searchTerms?: string[];
  maxPlaces?: number;
  saveListName?: string;
};

export type GoogleMapsImportPlan = {
  searchTerms: string[];
  searchTerm: string;
  location: ResolvedGoogleMapsLocation;
  maxPlaces: number;
  saveListName: string;
  estimatedCostUsd: number;
  approxDuration: string;
};

export function planGoogleMapsImport(
  input: GoogleMapsImportRequest
): GoogleMapsImportPlan | { error: string } {
  const searchTerms = parseGoogleMapsSearchTerms(
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

  const maxPlaces = clampGoogleMapsMaxPlaces(input.maxPlaces);
  const saveListName = (
    input.saveListName?.trim() ||
    `${defaultPoolImportListName("google_maps")} · ${formatGoogleMapsSearchLabel(searchTerms)}`
  ).slice(0, 120);

  return {
    searchTerms,
    searchTerm: joinGoogleMapsSearchTerms(searchTerms),
    location,
    maxPlaces,
    saveListName,
    estimatedCostUsd: estimateGoogleMapsSearchCostUsd({
      maxPlaces,
      findPeople: true,
    }),
    approxDuration: formatGoogleMapsApproxDuration(maxPlaces),
  };
}

export async function startGoogleMapsImport(
  coachId: string,
  plan: GoogleMapsImportPlan
) {
  const pool = await ensureCoachPool(coachId);
  const saveList = await createCoachAudienceList({
    coachId,
    name: plan.saveListName,
    source: "google_maps",
    filters: {
      from_pool_import: true,
      search_term: plan.searchTerm,
      search_terms: plan.searchTerms,
      location: plan.location.locationQuery,
      country_code: plan.location.countryCode,
      state_code: plan.location.stateCode,
      max_places: plan.maxPlaces,
      list_cap: MAX_LIST_ITEMS_TOTAL,
    },
  });
  const job = await createGoogleMapsSearchJob({
    coachId,
    listId: pool.id,
    saveListId: saveList.id,
    searchTerms: plan.searchTerms,
    location: plan.location.locationQuery,
    countryCode: plan.location.countryCode,
    stateLabel: plan.location.stateLabel,
    maxPlaces: plan.maxPlaces,
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

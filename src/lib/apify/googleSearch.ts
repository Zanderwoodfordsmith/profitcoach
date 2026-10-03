import { ApifyClient } from "apify-client";
import { getApifyRunState } from "@/lib/apify/salesNavigatorSearch";
import { googleMapsApifyCountryCode } from "@/lib/googleMaps/location";
import { googleSearchPagesPerQuery } from "@/lib/googleSearch/cost";
import {
  limitGoogleSearchResults,
  mapGoogleSearchDatasetItems,
} from "@/lib/googleSearch/mapResultsToPool";
import { buildGoogleSearchQueries } from "@/lib/googleSearch/searchTerms";

export { getApifyRunState };

const DEFAULT_ACTOR = "apify/google-search-scraper";

export class GoogleSearchScrapeError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not_configured"
      | "invalid_input"
      | "scrape_failed"
      | "empty_result"
  ) {
    super(message);
    this.name = "GoogleSearchScrapeError";
  }
}

function requireApifyToken(): string {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new GoogleSearchScrapeError(
      "Server is not configured with APIFY_TOKEN.",
      "not_configured"
    );
  }
  return token;
}

function resolveActorId(): string {
  return process.env.APIFY_GOOGLE_SEARCH_ACTOR?.trim() || DEFAULT_ACTOR;
}

export type StartGoogleSearchInput = {
  searchTerms: string[];
  locationQuery: string;
  countryCode?: string | null;
  maxResults: number;
  findPeople: boolean;
};

export type StartGoogleSearchRunResult = {
  apifyRunId: string;
  apifyDatasetId: string | null;
  actorId: string;
};

export async function startGoogleSearch(
  input: StartGoogleSearchInput
): Promise<StartGoogleSearchRunResult> {
  const token = requireApifyToken();
  const queries = buildGoogleSearchQueries(input.searchTerms, input.locationQuery);
  if (!queries.length) {
    throw new GoogleSearchScrapeError(
      "Enter a search like plumbers or dental practices.",
      "invalid_input"
    );
  }
  const countryCode = googleMapsApifyCountryCode(input.countryCode);
  const client = new ApifyClient({ token });
  const runInput: Record<string, unknown> = {
    queries: queries.join("\n"),
    maxPagesPerQuery: googleSearchPagesPerQuery(
      input.maxResults,
      queries.length
    ),
    ...(countryCode ? { countryCode } : {}),
    languageCode: "en",
    searchLanguage: "en",
    mobileResults: false,
    includeUnfilteredResults: false,
    saveHtml: false,
    saveHtmlToKeyValueStore: false,
    focusOnPaidAds: false,
    maximumLeadsEnrichmentRecords: input.findPeople ? 1 : 0,
  };

  let run;
  try {
    run = await client.actor(resolveActorId()).start(runInput);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google Search scrape failed.";
    throw new GoogleSearchScrapeError(message, "scrape_failed");
  }
  if (!run?.id) {
    throw new GoogleSearchScrapeError(
      "Apify did not return a run id.",
      "scrape_failed"
    );
  }
  return {
    apifyRunId: run.id,
    apifyDatasetId: run.defaultDatasetId ?? null,
    actorId: resolveActorId(),
  };
}

export async function fetchGoogleSearchDataset(opts: {
  datasetId: string;
  maxItems: number;
}): Promise<unknown[]> {
  const token = requireApifyToken();
  const client = new ApifyClient({ token });
  const maxItems = Math.max(1, Math.min(500, Math.floor(opts.maxItems)));
  const pageSize = 100;
  const allItems: unknown[] = [];
  for (let offset = 0; offset < maxItems; offset += pageSize) {
    const limit = Math.min(pageSize, maxItems - offset);
    const { items } = await client.dataset(opts.datasetId).listItems({
      limit,
      offset,
    });
    if (!items.length) break;
    allItems.push(...items);
    if (items.length < limit) break;
  }
  return allItems;
}

export async function fetchMappedGoogleSearchResults(opts: {
  datasetId: string;
  maxItems: number;
  maxResults: number;
}) {
  const items = await fetchGoogleSearchDataset(opts);
  const results = limitGoogleSearchResults(
    mapGoogleSearchDatasetItems(items),
    opts.maxResults
  );
  if (!results.length) {
    throw new GoogleSearchScrapeError(
      "Google finished, but none of the results were business websites.",
      "empty_result"
    );
  }
  return results;
}

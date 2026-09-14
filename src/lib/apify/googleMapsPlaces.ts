import { ApifyClient } from "apify-client";
import {
  getApifyRunState,
  abortApifyRun,
} from "@/lib/apify/salesNavigatorSearch";
import {
  clampGoogleMapsMaxPlaces,
  GOOGLE_MAPS_FIND_PERSON_MAX,
} from "@/lib/googleMaps/cost";
import { mapGoogleMapsDatasetItems } from "@/lib/googleMaps/mapPlaceToPool";
import {
  googleMapsPlacesPerSearch,
  parseGoogleMapsSearchTerms,
} from "@/lib/googleMaps/searchTerms";

export { abortApifyRun, getApifyRunState };

const DEFAULT_ACTOR = "compass/crawler-google-places";

export class GoogleMapsScrapeError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not_configured"
      | "invalid_input"
      | "scrape_failed"
      | "empty_result"
  ) {
    super(message);
    this.name = "GoogleMapsScrapeError";
  }
}

function requireApifyToken(): string {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new GoogleMapsScrapeError(
      "Server is not configured with APIFY_TOKEN.",
      "not_configured"
    );
  }
  return token;
}

function resolveActorId(): string {
  return process.env.APIFY_GOOGLE_MAPS_ACTOR?.trim() || DEFAULT_ACTOR;
}

export type StartGoogleMapsSearchInput = {
  searchTerm?: string;
  searchTerms?: string[];
  location: string;
  maxPlaces: number;
  findPeople: boolean;
  skipClosed?: boolean;
  scrapeContacts?: boolean;
};

export type StartGoogleMapsFindPersonInput = {
  placeIds: string[];
};

export type StartGoogleMapsRunResult = {
  apifyRunId: string;
  apifyDatasetId: string | null;
  actorId: string;
};

function requireSearchInput(input: StartGoogleMapsSearchInput): {
  searchTerms: string[];
  location: string;
  maxPlaces: number;
} {
  const searchTerms = parseGoogleMapsSearchTerms(
    input.searchTerms ?? input.searchTerm
  );
  const location = input.location.trim();
  if (!searchTerms.length) {
    throw new GoogleMapsScrapeError(
      "Enter a search like plumbers or dental practices.",
      "invalid_input"
    );
  }
  if (location.length < 2 || location.length > 120) {
    throw new GoogleMapsScrapeError(
      "Enter a city or area, for example Manchester, UK.",
      "invalid_input"
    );
  }
  return {
    searchTerms,
    location,
    maxPlaces: clampGoogleMapsMaxPlaces(input.maxPlaces),
  };
}

export async function startGoogleMapsSearch(
  input: StartGoogleMapsSearchInput
): Promise<StartGoogleMapsRunResult> {
  const token = requireApifyToken();
  const { searchTerms, location, maxPlaces } = requireSearchInput(input);
  const client = new ApifyClient({ token });
  const runInput: Record<string, unknown> = {
    searchStringsArray: searchTerms,
    locationQuery: location,
    maxCrawledPlacesPerSearch: googleMapsPlacesPerSearch(
      maxPlaces,
      searchTerms.length
    ),
    language: "en",
    skipClosedPlaces: input.skipClosed !== false,
    scrapeContacts: input.scrapeContacts !== false,
    scrapePlaceDetailPage: false,
    maximumLeadsEnrichmentRecords: input.findPeople ? 1 : 0,
  };

  let run;
  try {
    run = await client.actor(resolveActorId()).start(runInput);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google Maps scrape failed.";
    throw new GoogleMapsScrapeError(message, "scrape_failed");
  }
  if (!run?.id) {
    throw new GoogleMapsScrapeError(
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

export async function startGoogleMapsFindPerson(
  input: StartGoogleMapsFindPersonInput
): Promise<StartGoogleMapsRunResult> {
  const token = requireApifyToken();
  const placeIds = input.placeIds.slice(0, GOOGLE_MAPS_FIND_PERSON_MAX);
  if (!placeIds.length) {
    throw new GoogleMapsScrapeError(
      "Select businesses that have a Google Place ID.",
      "invalid_input"
    );
  }
  const client = new ApifyClient({ token });
  const runInput: Record<string, unknown> = {
    placeIds,
    language: "en",
    skipClosedPlaces: false,
    scrapeContacts: false,
    scrapePlaceDetailPage: true,
    maximumLeadsEnrichmentRecords: 1,
  };

  let run;
  try {
    run = await client.actor(resolveActorId()).start(runInput);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not start Find person.";
    throw new GoogleMapsScrapeError(message, "scrape_failed");
  }
  if (!run?.id) {
    throw new GoogleMapsScrapeError(
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

export async function fetchGoogleMapsDataset(opts: {
  datasetId: string;
  maxItems: number;
}): Promise<unknown[]> {
  const token = requireApifyToken();
  const client = new ApifyClient({ token });
  const maxItems = Math.max(1, Math.min(5_000, Math.floor(opts.maxItems)));
  const pageSize = 500;
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

export async function fetchMappedGoogleMapsPlaces(opts: {
  datasetId: string;
  maxItems: number;
}) {
  const items = await fetchGoogleMapsDataset(opts);
  const places = mapGoogleMapsDatasetItems(items);
  if (!places.length) {
    throw new GoogleMapsScrapeError(
      "Apify finished but returned no Google Maps places.",
      "empty_result"
    );
  }
  return places;
}

/** Starter (Bronze) pay-per-event rates for compass/crawler-google-places. */

export const GOOGLE_MAPS_PLACE_USD = 0.003;
export const GOOGLE_MAPS_FILTER_USD = 0.001;
export const GOOGLE_MAPS_CONTACTS_USD = 0.002;
export const GOOGLE_MAPS_PLACE_DETAILS_USD = 0.002;
export const GOOGLE_MAPS_LEAD_USD = 0.005;

export const GOOGLE_MAPS_MAX_PLACES = 1_000;
export const GOOGLE_MAPS_FIND_PERSON_MAX = 250;
export const GOOGLE_MAPS_SIZE_OPTIONS = [20, 50, 100, 250, 500, 1_000] as const;

export function clampGoogleMapsMaxPlaces(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(GOOGLE_MAPS_MAX_PLACES, n);
}

export function estimateGoogleMapsSearchCostUsd(opts: {
  maxPlaces: number;
  findPeople: boolean;
  skipClosed?: boolean;
  scrapeContacts?: boolean;
}): number {
  const places = clampGoogleMapsMaxPlaces(opts.maxPlaces);
  let usd = places * GOOGLE_MAPS_PLACE_USD;
  if (opts.skipClosed !== false) usd += places * GOOGLE_MAPS_FILTER_USD;
  if (opts.scrapeContacts !== false) usd += places * GOOGLE_MAPS_CONTACTS_USD;
  if (opts.findPeople) {
    // Hit-rate unknown; quote the max if every place yields one person.
    usd += places * GOOGLE_MAPS_LEAD_USD;
  }
  return Number(usd.toFixed(4));
}

export function estimateGoogleMapsFindPersonCostUsd(placeCount: number): number {
  const n = Math.max(0, Math.min(GOOGLE_MAPS_FIND_PERSON_MAX, Math.floor(placeCount)));
  return Number(
    (
      n * GOOGLE_MAPS_PLACE_USD +
      n * GOOGLE_MAPS_PLACE_DETAILS_USD +
      n * GOOGLE_MAPS_LEAD_USD
    ).toFixed(4)
  );
}

/** Observed ~2 min for 20 places with contacts + find-people. */
export const GOOGLE_MAPS_SECS_PER_PLACE = 6;

export function estimateGoogleMapsDurationSeconds(maxPlaces: number): number {
  const places = clampGoogleMapsMaxPlaces(maxPlaces);
  // Small runs still pay startup overhead (geocode, first map pages).
  return Math.max(45, Math.round(places * GOOGLE_MAPS_SECS_PER_PLACE));
}

export function formatGoogleMapsApproxDuration(maxPlaces: number): string {
  const secs = estimateGoogleMapsDurationSeconds(maxPlaces);
  if (secs < 90) return "About 1 min";
  const mins = Math.round(secs / 60);
  if (mins <= 2) return "About 2 min";
  if (mins <= 5) return `About ${mins} min`;
  const low = Math.max(2, mins - Math.ceil(mins * 0.25));
  const high = mins + Math.ceil(mins * 0.35);
  return `About ${low}–${high} min`;
}

export function googleMapsImportProgressPercent(opts: {
  progressCount: number;
  targetCount: number;
  startedAtMs: number;
  nowMs?: number;
  phase?: "scraping" | "finalizing";
}): number {
  const target = Math.max(1, opts.targetCount);
  const real = Math.min(
    100,
    Math.round((Math.max(0, opts.progressCount) / target) * 100)
  );
  if (opts.phase === "finalizing") {
    return Math.max(real, 92);
  }
  const elapsedSec = Math.max(
    0,
    ((opts.nowMs ?? Date.now()) - opts.startedAtMs) / 1000
  );
  const soft = Math.min(
    85,
    Math.round((elapsedSec / estimateGoogleMapsDurationSeconds(target)) * 100)
  );
  return Math.max(real, soft);
}

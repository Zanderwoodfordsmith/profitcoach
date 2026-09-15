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

/** One round number per size option: 100 → 10 min, 1,000 → 1 hr. */
const GOOGLE_MAPS_DURATION_MINUTES: Record<number, number> = {
  20: 2,
  50: 5,
  100: 10,
  250: 25,
  500: 50,
  1000: 60,
};

export function googleMapsApproxMinutes(maxPlaces: number): number {
  const places = clampGoogleMapsMaxPlaces(maxPlaces);
  const exact = GOOGLE_MAPS_DURATION_MINUTES[places];
  if (exact) return exact;
  return Math.max(2, Math.round(places / 10));
}

export function estimateGoogleMapsDurationSeconds(maxPlaces: number): number {
  return googleMapsApproxMinutes(maxPlaces) * 60;
}

export function formatGoogleMapsApproxDuration(maxPlaces: number): string {
  const mins = googleMapsApproxMinutes(maxPlaces);
  if (mins >= 60) return "1 hr";
  return `${mins} min`;
}

export function formatGoogleMapsSizeOption(maxPlaces: number): string {
  const places = clampGoogleMapsMaxPlaces(maxPlaces);
  return `${places.toLocaleString()} businesses (${formatGoogleMapsApproxDuration(places)})`;
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

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

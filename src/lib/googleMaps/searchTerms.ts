import { clampGoogleMapsMaxPlaces } from "@/lib/googleMaps/cost";

export const GOOGLE_MAPS_MAX_SEARCH_TERMS = 5;
export const GOOGLE_MAPS_SEARCH_TERM_MIN = 2;
export const GOOGLE_MAPS_SEARCH_TERM_MAX = 120;

function pushTerm(term: string, seen: Set<string>, out: string[]) {
  const normalized = term.trim().replace(/\s+/g, " ");
  if (
    normalized.length < GOOGLE_MAPS_SEARCH_TERM_MIN ||
    normalized.length > GOOGLE_MAPS_SEARCH_TERM_MAX
  ) {
    return;
  }
  const key = normalized.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(normalized);
}

/** Split rows and commas into distinct Google Maps queries. */
export function parseGoogleMapsSearchTerms(input: unknown): string[] {
  const chunks: string[] = [];
  if (typeof input === "string") chunks.push(input);
  else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") chunks.push(item);
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of chunks) {
    for (const part of chunk.split(",")) {
      pushTerm(part, seen, out);
      if (out.length >= GOOGLE_MAPS_MAX_SEARCH_TERMS) return out;
    }
  }
  return out;
}

export function joinGoogleMapsSearchTerms(terms: string[]): string {
  return parseGoogleMapsSearchTerms(terms).join(", ");
}

export function formatGoogleMapsSearchLabel(terms: string[]): string {
  const parsed = parseGoogleMapsSearchTerms(terms);
  if (!parsed.length) return "Google Maps";
  if (parsed.length <= 2) return parsed.join(" · ");
  return `${parsed[0]} · ${parsed[1]} +${parsed.length - 2}`;
}

/** Fair share of the total cap so search 1 cannot consume the whole limit. */
export function googleMapsPlacesPerSearch(
  maxPlaces: number,
  searchCount: number
): number {
  const places = clampGoogleMapsMaxPlaces(maxPlaces);
  const n = Math.max(
    1,
    Math.min(
      GOOGLE_MAPS_MAX_SEARCH_TERMS,
      Math.floor(Number(searchCount)) || 1
    )
  );
  return Math.max(1, Math.ceil(places / n));
}

export function formatGoogleMapsSplitHint(
  maxPlaces: number,
  searchCount: number
): string | null {
  const n = Math.floor(Number(searchCount)) || 0;
  if (n < 2) return null;
  const places = clampGoogleMapsMaxPlaces(maxPlaces);
  const per = googleMapsPlacesPerSearch(places, n);
  return `${places.toLocaleString()} businesses total, split across ${n} searches (about ${per} each). Same listing is only added once.`;
}

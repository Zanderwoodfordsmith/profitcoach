import { clampGoogleSearchMaxResults, googleSearchPagesPerQuery } from "@/lib/googleSearch/cost";
import {
  formatGoogleMapsSearchLabel,
  GOOGLE_MAPS_MAX_SEARCH_TERMS,
  joinGoogleMapsSearchTerms,
  parseGoogleMapsSearchTerms,
} from "@/lib/googleMaps/searchTerms";

export {
  GOOGLE_MAPS_MAX_SEARCH_TERMS as GOOGLE_SEARCH_MAX_SEARCH_TERMS,
  parseGoogleMapsSearchTerms as parseGoogleSearchTerms,
  joinGoogleMapsSearchTerms as joinGoogleSearchTerms,
  formatGoogleMapsSearchLabel as formatGoogleSearchLabel,
};

/** "dentists" + "Manchester, United Kingdom" → "dentists in Manchester, United Kingdom".
 *  Terms are already split. Do not split on commas again — the place contains them.
 */
export function buildGoogleSearchQueries(
  terms: string[],
  locationQuery: string
): string[] {
  const place = locationQuery.trim();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const term = raw.trim().replace(/\s+/g, " ");
    if (term.length < 2) continue;
    const query =
      !place || term.toLowerCase().includes(place.toLowerCase())
        ? term
        : `${term} in ${place}`;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(query);
    if (out.length >= GOOGLE_MAPS_MAX_SEARCH_TERMS) break;
  }
  return out;
}

export function formatGoogleSearchSplitHint(
  maxResults: number,
  searchCount: number
): string | null {
  const n = Math.floor(Number(searchCount)) || 0;
  if (n < 2) return null;
  const results = clampGoogleSearchMaxResults(maxResults);
  const pages = googleSearchPagesPerQuery(results, n);
  const per = Math.min(
    results,
    pages * 10
  );
  return `${results.toLocaleString()} businesses total, split across ${n} searches (about ${per} each). The same website is only added once.`;
}

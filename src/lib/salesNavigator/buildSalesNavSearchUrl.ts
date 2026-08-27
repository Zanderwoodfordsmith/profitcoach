/**
 * Build a LinkedIn Sales Navigator people-search URL from shared Lead Finder filters.
 * Encoding matches LinkedIn’s List(…) filter query shape.
 */

import {
  headcountBandForLabel,
  type SalesNavHeadcountId,
} from "@/lib/salesNavigator/headcountBands";
import { resolveSalesNavRegion } from "@/lib/salesNavigator/regions";

export type { SalesNavHeadcountId } from "@/lib/salesNavigator/headcountBands";

/** LinkedIn Sales Nav RELATIONSHIP filter ids */
export type SalesNavDegree = "1" | "2" | "3";

const DEGREE_FILTER: Record<
  SalesNavDegree,
  { id: string; text: string }
> = {
  "1": { id: "F", text: "1st Degree Connections" },
  "2": { id: "S", text: "2nd Degree Connections" },
  "3": { id: "O", text: "3rd+ Degree Connections" },
};

/**
 * LinkedIn Sales Nav YEARS_AT_CURRENT_COMPANY filter ids
 * (verified from live people-search URLs).
 */
export type SalesNavYearsAtCompanyId = "1" | "2" | "3" | "4" | "5";

export const YEARS_AT_CURRENT_COMPANY: Record<
  SalesNavYearsAtCompanyId,
  { id: SalesNavYearsAtCompanyId; text: string; label: string }
> = {
  "1": { id: "1", text: "Less than 1 year", label: "<1 yr" },
  "2": { id: "2", text: "1 to 2 years", label: "1–2 yrs" },
  "3": { id: "3", text: "3 to 5 years", label: "3–5 yrs" },
  "4": { id: "4", text: "6 to 10 years", label: "6–10 yrs" },
  "5": { id: "5", text: "More than 10 years", label: "10+ yrs" },
};

export type SalesNavKeyword = { term: string; mode: "include" | "exclude" };

export type BuildSalesNavSearchUrlInput = {
  titleKeywords: SalesNavKeyword[];
  companyKeywords: SalesNavKeyword[];
  /** Lead Finder team-size strings (e.g. "11-50"). */
  teamSizes: string[];
  /**
   * Free-text location as LinkedIn understands it
   * (e.g. "United Kingdom", "New York, United States", "Hertfordshire").
   * Must resolve to a Sales Nav REGION id — text-only REGION filters return 0 hits.
   */
  location?: string | null;
  /** Network degrees to include. Empty = no relationship filter. */
  degrees?: SalesNavDegree[];
  /** Posted on LinkedIn in the last 30 days (POSTED_ON_LINKEDIN / RPOL). */
  postedOnLinkedIn?: boolean;
  /** Changed jobs in the last 90 days (RECENTLY_CHANGED_JOBS / RPC). */
  recentlyChangedJobs?: boolean;
  /** Years at current company (YEARS_AT_CURRENT_COMPANY). Empty = no filter. */
  yearsAtCurrentCompany?: SalesNavYearsAtCompanyId[];
  /**
   * Top Keywords bar boolean query (AND / OR / NOT / quotes / parentheses).
   * Playbook: do not combine with CURRENT_COMPANY includes.
   */
  keywordsBoolean?: string | null;
};

function encText(text: string): string {
  return encodeURIComponent(encodeURIComponent(text));
}

function keywordValues(keywords: SalesNavKeyword[]): string {
  return keywords
    .filter((k) => k.term.trim())
    .map((k) => {
      const sel = k.mode === "exclude" ? "EXCLUDED" : "INCLUDED";
      return `(text%3A${encText(k.term.trim())}%2CselectionType%3A${sel})`;
    })
    .join("%2C");
}

function headcountValues(teamSizes: string[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const size of teamSizes) {
    const mapped = headcountBandForLabel(size);
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    parts.push(
      `(id%3A${mapped.id}%2Ctext%3A${encodeURIComponent(mapped.label)}%2CselectionType%3AINCLUDED)`
    );
  }
  return parts.join("%2C");
}

function relationshipValues(degrees: SalesNavDegree[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const d of degrees) {
    const mapped = DEGREE_FILTER[d];
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    parts.push(
      `(id%3A${mapped.id}%2Ctext%3A${encText(mapped.text)}%2CselectionType%3AINCLUDED)`
    );
  }
  return parts.join("%2C");
}

function yearsAtCompanyValues(ids: SalesNavYearsAtCompanyId[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const id of ids) {
    const mapped = YEARS_AT_CURRENT_COMPANY[id];
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    parts.push(
      `(id%3A${mapped.id}%2Ctext%3A${encText(mapped.text)}%2CselectionType%3AINCLUDED)`
    );
  }
  return parts.join("%2C");
}

function regionValues(location: string): string | null {
  const region = resolveSalesNavRegion(location);
  if (!region) return null;
  // Match LinkedIn’s working shape: id + double-encoded text.
  return `(id%3A${region.id}%2Ctext%3A${encText(region.text)}%2CselectionType%3AINCLUDED)`;
}

export function buildSalesNavSearchUrl(input: BuildSalesNavSearchUrlInput): string {
  const filters: string[] = [];

  const companyVals = keywordValues(input.companyKeywords);
  if (companyVals) {
    filters.push(`(type%3ACURRENT_COMPANY%2Cvalues%3AList(${companyVals}))`);
  }

  const headcounts = headcountValues(input.teamSizes);
  if (headcounts) {
    filters.push(`(type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList(${headcounts}))`);
  }

  const location = input.location?.trim();
  if (location) {
    const region = regionValues(location);
    if (region) {
      filters.push(`(type%3AREGION%2Cvalues%3AList(${region}))`);
    }
    // If we can't resolve an id, omit REGION entirely (text-only = 0 results).
  }

  const degrees = input.degrees ?? [];
  const relationships = relationshipValues(degrees);
  if (relationships) {
    filters.push(`(type%3ARELATIONSHIP%2Cvalues%3AList(${relationships}))`);
  }

  const titleVals = keywordValues(input.titleKeywords);
  if (titleVals) {
    filters.push(`(type%3ACURRENT_TITLE%2Cvalues%3AList(${titleVals}))`);
  }

  if (input.postedOnLinkedIn) {
    filters.push(
      `(type%3APOSTED_ON_LINKEDIN%2Cvalues%3AList((id%3ARPOL%2Ctext%3A${encText("Posted on LinkedIn")}%2CselectionType%3AINCLUDED)))`
    );
  }

  if (input.recentlyChangedJobs) {
    filters.push(
      `(type%3ARECENTLY_CHANGED_JOBS%2Cvalues%3AList((id%3ARPC%2Ctext%3A${encText("Changed jobs")}%2CselectionType%3AINCLUDED)))`
    );
  }

  const yearsAt = yearsAtCompanyValues(input.yearsAtCurrentCompany ?? []);
  if (yearsAt) {
    filters.push(
      `(type%3AYEARS_AT_CURRENT_COMPANY%2Cvalues%3AList(${yearsAt}))`
    );
  }

  // `query` is already percent-encoded for LinkedIn’s List(…) shape — do not
  // run it through URLSearchParams (that would double-encode %).
  const query = `(recentSearchParam%3A(doLogHistory%3Atrue)%2Cfilters%3AList(${filters.join("%2C")}))`;
  let url = `https://www.linkedin.com/sales/search/people?query=${query}&viewAllFilters=true`;
  const keywords = input.keywordsBoolean?.trim();
  if (keywords) {
    url += `&keywords=${encodeURIComponent(keywords)}`;
  }
  return url;
}

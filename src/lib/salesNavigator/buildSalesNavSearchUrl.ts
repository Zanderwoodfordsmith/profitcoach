/**
 * Build a LinkedIn Sales Navigator people-search URL from shared Lead Finder filters.
 * Encoding matches LinkedIn’s List(…) filter query shape.
 */

export type SalesNavHeadcountId =
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I";

const HEADCOUNT_FROM_TEAM_SIZE: Record<string, { id: SalesNavHeadcountId; label: string }> = {
  "1-10": { id: "B", label: "1-10" },
  "11-50": { id: "C", label: "11-50" },
  "51-200": { id: "D", label: "51-200" },
  "201-500": { id: "E", label: "201-500" },
  "501-1000": { id: "F", label: "501-1000" },
  "1001-5000": { id: "G", label: "1001-5000" },
  "5001-10000": { id: "H", label: "5001-10000" },
  "10001+": { id: "I", label: "10001+" },
};

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

export type SalesNavKeyword = { term: string; mode: "include" | "exclude" };

export type BuildSalesNavSearchUrlInput = {
  titleKeywords: SalesNavKeyword[];
  companyKeywords: SalesNavKeyword[];
  /** Lead Finder team-size strings (e.g. "11-50"). */
  teamSizes: string[];
  /**
   * Free-text location as LinkedIn understands it
   * (e.g. "United Kingdom", "New York, United States", "Hertfordshire").
   */
  location?: string | null;
  /** Network degrees to include. Empty = no relationship filter. */
  degrees?: SalesNavDegree[];
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
    const mapped = HEADCOUNT_FROM_TEAM_SIZE[size];
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
    filters.push(
      `(type%3AREGION%2Cvalues%3AList((text%3A${encText(location)}%2CselectionType%3AINCLUDED)))`
    );
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

  const query = `(recentSearchParam%3A(doLogHistory%3Atrue)%2Cfilters%3AList(${filters.join("%2C")}))`;
  return `https://www.linkedin.com/sales/search/people?query=${query}&viewAllFilters=true`;
}

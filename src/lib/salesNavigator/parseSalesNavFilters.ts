/**
 * Pull filter values from a Sales Navigator people-search URL.
 * Encoding is messy (single/double URI encoding); we decode iteratively.
 */

import type {
  SalesNavDegree,
  SalesNavYearsAtCompanyId,
} from "@/lib/salesNavigator/buildSalesNavSearchUrl";

const HEADCOUNT_BY_ID: Record<string, string> = {
  B: "1-10",
  C: "11-50",
  D: "51-200",
  E: "201-500",
  F: "501-1000",
  G: "1001-5000",
  H: "5001-10000",
  I: "10001+",
};

const DEGREE_BY_ID: Record<string, SalesNavDegree> = {
  F: "1",
  S: "2",
  O: "3",
};

const YEARS_AT_COMPANY_IDS = new Set<SalesNavYearsAtCompanyId>([
  "1",
  "2",
  "3",
  "4",
  "5",
]);

export type ParsedSalesNavKeyword = {
  term: string;
  mode: "include" | "exclude";
};

export type ParsedSalesNavFilters = {
  titleKeywords: ParsedSalesNavKeyword[];
  companyKeywords: ParsedSalesNavKeyword[];
  teamSizes: string[];
  location: string | null;
  degrees: SalesNavDegree[];
  yearsAtCurrentCompany: SalesNavYearsAtCompanyId[];
  /** Top Keywords bar boolean string, if present. */
  keywordsBoolean: string | null;
};

function fullyDecode(raw: string): string {
  let prev = raw;
  for (let i = 0; i < 4; i++) {
    try {
      const next = decodeURIComponent(prev);
      if (next === prev) break;
      prev = next;
    } catch {
      break;
    }
  }
  return prev;
}

function queryBlobFromSalesNavUrl(salesNavUrl: string): string {
  try {
    const u = new URL(salesNavUrl);
    return fullyDecode(u.searchParams.get("query") ?? salesNavUrl);
  } catch {
    return fullyDecode(salesNavUrl);
  }
}

function filterSection(blob: string, type: string): string | null {
  const re = new RegExp(`type:${type},values:List\\(([\\s\\S]*?)\\)\\)`);
  return blob.match(re)?.[1] ?? null;
}

function parseKeywordSection(section: string | null): ParsedSalesNavKeyword[] {
  if (!section) return [];
  const out: ParsedSalesNavKeyword[] = [];
  for (const m of section.matchAll(
    /\((?:id:[^,]+,)?text:([^,]+),selectionType:(INCLUDED|EXCLUDED)\)/g
  )) {
    const term = fullyDecode(m[1] ?? "").trim();
    if (!term) continue;
    out.push({
      term,
      mode: m[2] === "EXCLUDED" ? "exclude" : "include",
    });
  }
  return out;
}

/**
 * Team sizes included via COMPANY_HEADCOUNT.
 * Returns a single size when exactly one is selected; otherwise null
 * (don't invent a specific size for multi-select searches).
 */
export function teamSizeFromSalesNavUrl(
  salesNavUrl: string | null | undefined
): string | null {
  const sizes = teamSizesFromSalesNavUrl(salesNavUrl);
  return sizes.length === 1 ? sizes[0]! : null;
}

export function teamSizesFromSalesNavUrl(
  salesNavUrl: string | null | undefined
): string[] {
  if (!salesNavUrl?.trim()) return [];
  const blob = queryBlobFromSalesNavUrl(salesNavUrl);
  const section = filterSection(blob, "COMPANY_HEADCOUNT");
  if (!section) return [];

  const sizes = new Set<string>();
  for (const m of section.matchAll(/id:([B-I])\b/g)) {
    const label = HEADCOUNT_BY_ID[m[1]!];
    if (label) sizes.add(label);
  }
  for (const m of section.matchAll(/text:(\d+-\d+|\d+\+)/g)) {
    sizes.add(m[1]!);
  }
  return [...sizes];
}

/** Best-effort parse of a people-search URL into Lead Finder sidebar filters. */
export function parseSalesNavSearchUrl(
  salesNavUrl: string
): ParsedSalesNavFilters {
  const blob = queryBlobFromSalesNavUrl(salesNavUrl);

  const titleKeywords = parseKeywordSection(
    filterSection(blob, "CURRENT_TITLE")
  );
  const companyKeywords = parseKeywordSection(
    filterSection(blob, "CURRENT_COMPANY")
  );

  const regionSection = filterSection(blob, "REGION");
  let location: string | null = null;
  if (regionSection) {
    const m = regionSection.match(/text:([^,]+),selectionType:INCLUDED/);
    if (m?.[1]) location = fullyDecode(m[1]).trim() || null;
  }

  const relSection = filterSection(blob, "RELATIONSHIP");
  const degrees: SalesNavDegree[] = [];
  if (relSection) {
    for (const m of relSection.matchAll(/id:([FSO])\b/g)) {
      const d = DEGREE_BY_ID[m[1]!];
      if (d && !degrees.includes(d)) degrees.push(d);
    }
  }

  const yearsSection = filterSection(blob, "YEARS_AT_CURRENT_COMPANY");
  const yearsAtCurrentCompany: SalesNavYearsAtCompanyId[] = [];
  if (yearsSection) {
    for (const m of yearsSection.matchAll(/id:([1-5])\b/g)) {
      const id = m[1] as SalesNavYearsAtCompanyId;
      if (YEARS_AT_COMPANY_IDS.has(id) && !yearsAtCurrentCompany.includes(id)) {
        yearsAtCurrentCompany.push(id);
      }
    }
  }

  let keywordsBoolean: string | null = null;
  try {
    const u = new URL(salesNavUrl);
    const kw = u.searchParams.get("keywords")?.trim();
    keywordsBoolean = kw || null;
  } catch {
    keywordsBoolean = null;
  }

  return {
    titleKeywords,
    companyKeywords,
    teamSizes: teamSizesFromSalesNavUrl(salesNavUrl),
    location,
    degrees,
    yearsAtCurrentCompany,
    keywordsBoolean,
  };
}

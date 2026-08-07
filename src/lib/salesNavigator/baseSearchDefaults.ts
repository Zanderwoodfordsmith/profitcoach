/**
 * BCA “base search” defaults — shared by Lead Finder and Sales Navigator link gen.
 * Ported from sales-navigator-generator.html (Claude Code tool).
 */

export const BASE_SEARCH_TITLE_INCLUDES = [
  "Owner",
  "co-owner",
  "founder",
  "co-founder",
  "CEO",
  "Managing director",
  "co-managing director",
  "Managing partner",
  "co-managing partner",
] as const;

/** Competitors / wrong ICP — applied as title excludes by default. */
export const BASE_SEARCH_TITLE_EXCLUDES = [
  "coach",
  "coaching",
  "consultant",
  "consulting",
  "consultants",
  "psychologist",
  "recruiter",
  "recruiting",
  "recruitment",
  "recruit",
] as const;

/** Same blacklist on current company name. */
export const BASE_SEARCH_COMPANY_EXCLUDES = [
  "coach",
  "coaching",
  "consultant",
  "consulting",
  "consultants",
  "psychologist",
  "recruiter",
  "recruiting",
  "recruitment",
  "recruit",
] as const;

export type FilterKeywordSeed = { term: string; mode: "include" | "exclude" };

export function defaultJobTitleKeywords(): FilterKeywordSeed[] {
  return [
    ...BASE_SEARCH_TITLE_INCLUDES.map((term) => ({
      term,
      mode: "include" as const,
    })),
    ...BASE_SEARCH_TITLE_EXCLUDES.map((term) => ({
      term,
      mode: "exclude" as const,
    })),
  ];
}

export function defaultCompanyKeywords(): FilterKeywordSeed[] {
  return BASE_SEARCH_COMPANY_EXCLUDES.map((term) => ({
    term,
    mode: "exclude" as const,
  }));
}

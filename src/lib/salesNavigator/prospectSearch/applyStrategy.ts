import {
  defaultCompanyKeywords,
  defaultJobTitleKeywords,
} from "@/lib/salesNavigator/baseSearchDefaults";
import type {
  SalesNavDegree,
  SalesNavKeyword,
} from "@/lib/salesNavigator/buildSalesNavSearchUrl";
import type { ProspectSearchStrategy } from "@/lib/salesNavigator/prospectSearch/types";

/** Classroom base-search headcounts (Build Your Base Search). */
export const BASE_SEARCH_TEAM_SIZES = ["1-10", "11-50", "51-200"] as const;

/** Connector-campaign default degrees. */
export const BASE_SEARCH_DEGREES: SalesNavDegree[] = ["2", "3"];

export type AppliedProspectSearchFilters = {
  companyKeywords: SalesNavKeyword[];
  jobTitleKeywords: SalesNavKeyword[];
  /** Sales Nav Keywords bar (boolean). Empty string clears it. */
  keywordsBoolean: string;
  /** Clear the free-text Industry field — terms live on companyKeywords instead. */
  clearIndustry: boolean;
  /** Apply Classroom base headcounts when applying a strategy. */
  teamSizes: string[];
  degrees: SalesNavDegree[];
};

/**
 * Map a strategy onto Lead Finder Sales Nav filter state.
 * Keeps base excludes; replaces company includes / keywords per playbook rules.
 */
export function applyProspectSearchStrategy(
  strategy: ProspectSearchStrategy
): AppliedProspectSearchFilters {
  const baseCompany = defaultCompanyKeywords();
  const baseTitles = defaultJobTitleKeywords();

  const excludeExtras = strategy.filters.companyExcludesExtra.map((term) => ({
    term,
    mode: "exclude" as const,
  }));

  const titleExtras = strategy.filters.titleIncludesExtra.map((term) => ({
    term,
    mode: "include" as const,
  }));

  // Dedupe titles by lowercased term; extras win over defaults if clash.
  const titleMap = new Map<string, SalesNavKeyword>();
  for (const k of baseTitles) titleMap.set(k.term.toLowerCase(), k);
  for (const k of titleExtras) titleMap.set(k.term.toLowerCase(), k);

  if (
    strategy.kind === "company_name" ||
    strategy.kind === "category_name"
  ) {
    const includes = strategy.filters.companyIncludes.map((term) => ({
      term,
      mode: "include" as const,
    }));
    const companyMap = new Map<string, SalesNavKeyword>();
    for (const k of [...baseCompany, ...excludeExtras]) {
      companyMap.set(k.term.toLowerCase(), k);
    }
    for (const k of includes) {
      companyMap.set(k.term.toLowerCase(), k);
    }
    return {
      companyKeywords: [...companyMap.values()],
      jobTitleKeywords: [...titleMap.values()],
      keywordsBoolean: "",
      clearIndustry: true,
      teamSizes: [...BASE_SEARCH_TEAM_SIZES],
      degrees: [...BASE_SEARCH_DEGREES],
    };
  }

  if (strategy.kind === "keywords") {
    const companyMap = new Map<string, SalesNavKeyword>();
    for (const k of [...baseCompany, ...excludeExtras]) {
      companyMap.set(k.term.toLowerCase(), k);
    }
    // Intentionally no company includes — playbook mutual exclusion.
    return {
      companyKeywords: [...companyMap.values()],
      jobTitleKeywords: [...titleMap.values()],
      keywordsBoolean: strategy.filters.keywordsBoolean?.trim() ?? "",
      clearIndustry: true,
      teamSizes: [...BASE_SEARCH_TEAM_SIZES],
      degrees: [...BASE_SEARCH_DEGREES],
    };
  }

  // beyond_linkedin — leave base search, clear narrowing.
  return {
    companyKeywords: baseCompany,
    jobTitleKeywords: [...titleMap.values()],
    keywordsBoolean: "",
    clearIndustry: true,
    teamSizes: [...BASE_SEARCH_TEAM_SIZES],
    degrees: [...BASE_SEARCH_DEGREES],
  };
}

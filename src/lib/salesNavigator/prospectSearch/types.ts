/**
 * Sales Navigator prospect-search strategies suggested from an ideal avatar / industry.
 * Encodes BCA Classroom methodology (base search → company name → keywords → beyond).
 */

export type NamingPattern =
  | "name_rich"
  | "category_rich"
  | "name_poor"
  | "mixed";

export type StrategyKind =
  | "company_name"
  | "category_name"
  | "keywords"
  | "beyond_linkedin";

export type ProspectSearchStrategyFilters = {
  /** CURRENT_COMPANY includes (green). Empty for keyword / beyond strategies. */
  companyIncludes: string[];
  /** Extra CURRENT_COMPANY excludes beyond the base coach/consultant blacklist. */
  companyExcludesExtra: string[];
  /**
   * Sales Nav top Keywords bar boolean string (AND / OR / NOT / quotes / parentheses).
   * Only for `keywords` strategies. Must be null when using company includes.
   */
  keywordsBoolean: string | null;
  /** Optional extra CURRENT_TITLE includes (e.g. Head Architect). */
  titleIncludesExtra: string[];
};

export type ProspectSearchStrategy = {
  id: string;
  /** 1 = try first. */
  priority: number;
  kind: StrategyKind;
  label: string;
  rationale: string;
  namingPattern: NamingPattern;
  /** e.g. "~8/10 spot-check" or "~40–50% keepers" */
  qualityTarget: string;
  /** When this strategy is appropriate. */
  tryWhen: string;
  /** What to do if list is too small / too noisy. */
  nextIf: string;
  filters: ProspectSearchStrategyFilters;
  tips: string[];
};

export type ProspectSearchStrategiesResult = {
  industry: string;
  namingPattern: NamingPattern;
  namingPatternRationale: string;
  strategies: ProspectSearchStrategy[];
  /** True when keyword / name-poor path needs 3 ideal profiles to sharpen. */
  sampleProfilesNeeded: boolean;
  coachFacingSummary: string;
};

export type ProspectSearchStrategiesRequest = {
  /**
   * Ideal avatar / industry / niche description.
   * Optional when the coach has an AI-brain / First Campaign avatar — server fills it.
   */
  industry?: string | null;
  /** Optional geography override (defaults to Lead Finder SN location). */
  location?: string | null;
  /** Free-text notes: exhausted lists, dislikes, specialisms. */
  notes?: string | null;
  /**
   * Optional notes from scanning ~3 ideal LinkedIn profiles
   * (words that only their tribe uses).
   */
  sampleProfileNotes?: string | null;
  /** When true (default), inject selected avatar / ICP / AI brain into the prompt. */
  useBrainAvatar?: boolean;
};

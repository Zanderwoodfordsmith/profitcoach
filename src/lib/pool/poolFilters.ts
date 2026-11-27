import type { FitLabel } from "@/lib/pool/fit";
import {
  isPoolOutreachStatus,
  type PoolOutreachStatus,
} from "@/lib/pool/outreachStatus";
import {
  poolRowMatchesCityFilter,
  poolRowMatchesContactFilter,
  poolRowMatchesDateAddedFilter,
  poolRowMatchesHeadcountFilter,
  poolRowMatchesIndustryFilter,
  poolRowMatchesLinkedInFilter,
  poolRowMatchesPostcodeFilter,
  poolRowPassesExcludedTags,
  type PoolContactFilter,
  type PoolDateAddedFilter,
  type PoolLinkedInFilter,
  type PoolPerson,
} from "@/lib/pool/poolPeople";

/** "No tags" in the Tags list. */
export const POOL_NO_TAGS = "__none__";
/** "In any campaign" / "Not in a campaign" in the Campaign list. */
export const POOL_CAMPAIGN_ANY = "__any__";
export const POOL_CAMPAIGN_NONE = "__none__";

export type PoolFitKey = FitLabel | "none";

/**
 * Lead Lists filters. Lists are "any of these" (empty = everyone); the
 * filters themselves combine with AND.
 */
export type PoolFilters = {
  statusFilter: PoolOutreachStatus[];
  fitFilter: PoolFitKey[];
  /** Tag names, or POOL_NO_TAGS. */
  tagFilter: string[];
  /** Hide people carrying any of these tags (case-insensitive). */
  excludeTags: string[];
  /** Headcount bands; "unknown" means no headcount on the row. */
  headcountFilter: string[];
  /** Campaign ids, POOL_CAMPAIGN_ANY or POOL_CAMPAIGN_NONE. */
  campaignFilter: string[];
  sourceFilter: string[];
  contactFilter: PoolContactFilter;
  linkedinFilter: PoolLinkedInFilter;
  dateAddedFilter: PoolDateAddedFilter;
  cityFilter: string;
  postcodeFilter: string;
  industryFilter: string;
};

export function createEmptyPoolFilters(): PoolFilters {
  return {
    statusFilter: [],
    fitFilter: [],
    tagFilter: [],
    excludeTags: [],
    headcountFilter: [],
    campaignFilter: [],
    sourceFilter: [],
    contactFilter: "all",
    linkedinFilter: "all",
    dateAddedFilter: "all",
    cityFilter: "",
    postcodeFilter: "",
    industryFilter: "",
  };
}

/** Trimmed, de-duplicated (case-insensitive) strings. */
function stringList(value: unknown, max = 200): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim().slice(0, 120);
    if (!text) continue;
    if (out.some((existing) => existing.toLowerCase() === text.toLowerCase())) continue;
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

/** Old saved tabs held one value per filter ("all" = everyone). */
function legacyOne(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const text = value.trim();
  return !text || text === "all" ? [] : [text];
}

function listOrLegacy(value: unknown): string[] {
  return Array.isArray(value) ? stringList(value) : legacyOne(value);
}

function isFitKey(value: string): value is PoolFitKey {
  return value === "good" || value === "ok" || value === "bad" || value === "none";
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function placeQuery(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function headcountList(value: unknown): string[] {
  return stringList(value, 12).map((item) =>
    item.toLowerCase() === "unknown" ? "unknown" : item.slice(0, 40)
  );
}

/** Reads saved settings, old single-choice ones included. */
export function normalizePoolFilters(raw: unknown): PoolFilters {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  let tagFilter: string[];
  if (Array.isArray(source.tagFilter)) {
    tagFilter = stringList(source.tagFilter);
  } else {
    tagFilter = legacyOne(source.tagFilter).map((tag) =>
      tag === "none" ? POOL_NO_TAGS : tag
    );
  }

  let campaignFilter: string[];
  if (Array.isArray(source.campaignFilter)) {
    campaignFilter = stringList(source.campaignFilter);
  } else {
    const id =
      typeof source.campaignIdFilter === "string" ? source.campaignIdFilter.trim() : "";
    campaignFilter = id
      ? [id.slice(0, 80)]
      : source.campaignFilter === "in_campaign"
        ? [POOL_CAMPAIGN_ANY]
        : source.campaignFilter === "not_in_campaign"
          ? [POOL_CAMPAIGN_NONE]
          : [];
  }

  return {
    statusFilter: listOrLegacy(source.statusFilter).filter(isPoolOutreachStatus),
    fitFilter: listOrLegacy(source.fitFilter).filter(isFitKey),
    tagFilter,
    excludeTags: stringList(source.excludeTags),
    headcountFilter: headcountList(source.headcountFilter),
    campaignFilter,
    sourceFilter: listOrLegacy(source.sourceFilter),
    contactFilter: oneOf(source.contactFilter, ["all", "email", "phone", "both", "none"], "all"),
    linkedinFilter: oneOf(source.linkedinFilter, ["all", "has", "none"], "all"),
    dateAddedFilter: oneOf(
      source.dateAddedFilter,
      ["all", "today", "7d", "30d", "older_than_30d"],
      "all"
    ),
    cityFilter: placeQuery(source.cityFilter),
    postcodeFilter: placeQuery(source.postcodeFilter),
    industryFilter: placeQuery(source.industryFilter),
  };
}

/** How many filters are on (a list with picks counts once). */
export function countActivePoolFilters(filters: PoolFilters): number {
  return (
    (filters.statusFilter.length ? 1 : 0) +
    (filters.fitFilter.length ? 1 : 0) +
    (filters.tagFilter.length ? 1 : 0) +
    (filters.excludeTags.length ? 1 : 0) +
    (filters.headcountFilter.length ? 1 : 0) +
    (filters.campaignFilter.length ? 1 : 0) +
    (filters.sourceFilter.length ? 1 : 0) +
    (filters.contactFilter !== "all" ? 1 : 0) +
    (filters.linkedinFilter !== "all" ? 1 : 0) +
    (filters.dateAddedFilter !== "all" ? 1 : 0) +
    (filters.cityFilter.trim() ? 1 : 0) +
    (filters.postcodeFilter.trim() ? 1 : 0) +
    (filters.industryFilter.trim() ? 1 : 0)
  );
}

export function poolRowMatchesFilters(
  row: PoolPerson,
  filters: PoolFilters,
  now = Date.now()
): boolean {
  if (
    filters.statusFilter.length &&
    !filters.statusFilter.includes(row.outreach_status ?? "none")
  ) {
    return false;
  }
  if (filters.fitFilter.length && !filters.fitFilter.includes(row.fit ?? "none")) {
    return false;
  }
  if (filters.tagFilter.length) {
    const tags = (row.tags ?? []).map((tag) => tag.toLowerCase());
    const hit = filters.tagFilter.some((key) =>
      key === POOL_NO_TAGS ? tags.length === 0 : tags.includes(key.toLowerCase())
    );
    if (!hit) return false;
  }
  if (!poolRowPassesExcludedTags(row, filters.excludeTags)) return false;
  if (!poolRowMatchesHeadcountFilter(row, filters.headcountFilter)) return false;
  if (filters.campaignFilter.length) {
    const ids = row.campaign_ids ?? [];
    const hit = filters.campaignFilter.some((key) =>
      key === POOL_CAMPAIGN_ANY
        ? row.in_campaign
        : key === POOL_CAMPAIGN_NONE
          ? !row.in_campaign
          : ids.includes(key)
    );
    if (!hit) return false;
  }
  if (filters.sourceFilter.length && !filters.sourceFilter.includes(row.source)) {
    return false;
  }
  if (!poolRowMatchesContactFilter(row, filters.contactFilter)) return false;
  if (!poolRowMatchesLinkedInFilter(row, filters.linkedinFilter)) return false;
  if (!poolRowMatchesDateAddedFilter(row, filters.dateAddedFilter, now)) return false;
  if (!poolRowMatchesCityFilter(row, filters.cityFilter)) return false;
  if (!poolRowMatchesPostcodeFilter(row, filters.postcodeFilter)) return false;
  if (!poolRowMatchesIndustryFilter(row, filters.industryFilter)) return false;
  return true;
}

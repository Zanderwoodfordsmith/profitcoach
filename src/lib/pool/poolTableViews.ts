import {
  ALL_POOL_COLUMN_KEYS,
  DEFAULT_POOL_COLUMN_ORDER,
  DEFAULT_POOL_COLUMN_VISIBILITY,
  defaultPoolGrouping,
  POOL_COLUMN_LAYOUT_VERSION,
  POOL_LEAD_FOLDED_COLUMN_KEYS,
  type PersistedPoolGrouping,
  type PoolCampaignFilter,
  type PoolColumnKey,
  type PoolColumnVisibility,
  type PoolContactFilter,
  type PoolDateAddedFilter,
  type PoolHeadcountFilter,
  type PoolLinkedInFilter,
  type PoolGroupField,
  type PoolGroupOrder,
  type PoolSortField,
  type PoolSortOrder,
  type PoolTagFilter,
} from "@/lib/pool/poolPeople";
import { completeColumnOrder } from "@/lib/table/completeColumnOrder";
import {
  DEFAULT_PROSPECT_TABLE_VIEW_NAME,
  generateProspectTableViewId,
  isDefaultProspectTableViewName,
  MAX_PROSPECT_TABLE_VIEW_NAME_LENGTH,
  MAX_PROSPECT_TABLE_VIEW_SETTINGS_BYTES,
  uniqueProspectViewCopyName,
} from "@/lib/prospects/prospectTableViews";

export const POOL_TABLE_VIEW_SURFACE = "pool" as const;
export const DEFAULT_POOL_TABLE_VIEW_NAME = DEFAULT_PROSPECT_TABLE_VIEW_NAME;
export { isDefaultProspectTableViewName, generateProspectTableViewId };
export {
  MAX_PROSPECT_TABLE_VIEW_NAME_LENGTH as MAX_POOL_TABLE_VIEW_NAME_LENGTH,
  MAX_PROSPECT_TABLE_VIEW_SETTINGS_BYTES as MAX_POOL_TABLE_VIEW_SETTINGS_BYTES,
};

export type PoolTableViewSettings = {
  sourceFilter: string;
  campaignFilter: PoolCampaignFilter;
  /** A specific campaign. Empty means the status filter above applies. */
  campaignIdFilter: string;
  contactFilter: PoolContactFilter;
  linkedinFilter: PoolLinkedInFilter;
  dateAddedFilter: PoolDateAddedFilter;
  headcountFilter: PoolHeadcountFilter;
  cityFilter: string;
  postcodeFilter: string;
  industryFilter: string;
  tagFilter: PoolTagFilter;
  /** Hide people carrying any of these tags (case-insensitive). */
  excludeTags: string[];
  sortField: PoolSortField;
  sortOrder: PoolSortOrder;
  grouping: PersistedPoolGrouping;
  columnVisibility: PoolColumnVisibility;
  columnOrder: PoolColumnKey[];
  columnLayoutVersion: number;
};

export type PoolTableView = {
  id: string;
  name: string;
  settings: PoolTableViewSettings;
  createdBy: string;
  canEdit: boolean;
};

export type PoolTableViewsPayload = {
  currentUserId: string;
  views: PoolTableView[];
  activeViewId: string;
  autosave: boolean;
  viewOrder: string[];
};

export type PoolTableViewsStorage = {
  version: 1;
  views: PoolTableView[];
  activeViewId: string;
  autosave: boolean;
  viewOrder: string[];
};

const POOL_SORT_FIELDS: PoolSortField[] = [
  "name",
  "company",
  "created_at",
  "source",
];

function isPoolSortField(value: unknown): value is PoolSortField {
  return typeof value === "string" && POOL_SORT_FIELDS.includes(value as PoolSortField);
}

function isPoolColumnKey(value: unknown): value is PoolColumnKey {
  return typeof value === "string" && ALL_POOL_COLUMN_KEYS.includes(value as PoolColumnKey);
}

function normalizeGrouping(raw: unknown): PersistedPoolGrouping {
  const defaults = defaultPoolGrouping();
  if (!raw || typeof raw !== "object") return defaults;
  const source = raw as Partial<PersistedPoolGrouping>;
  const field: PoolGroupField | null =
    source.field === "source" ||
    source.field === "company" ||
    source.field === "campaign" ||
    source.field === "tags"
      ? source.field
      : null;
  const order: PoolGroupOrder =
    source.order === "desc" || source.order === "manual" ? source.order : "asc";
  const manualOrder: Record<string, string[]> = {};
  if (source.manualOrder && typeof source.manualOrder === "object") {
    for (const [key, value] of Object.entries(source.manualOrder)) {
      if (Array.isArray(value)) {
        manualOrder[key] = value.filter((id): id is string => typeof id === "string");
      }
    }
  }
  return { field, order, manualOrder };
}

function normalizeColumns(source: Partial<PoolTableViewSettings>): {
  columnVisibility: PoolColumnVisibility;
  columnOrder: PoolColumnKey[];
  columnLayoutVersion: number;
} {
  const savedVersion =
    typeof source.columnLayoutVersion === "number" &&
    Number.isFinite(source.columnLayoutVersion)
      ? source.columnLayoutVersion
      : 0;
  const columnVisibility = { ...DEFAULT_POOL_COLUMN_VISIBILITY };
  if (source.columnVisibility && typeof source.columnVisibility === "object") {
    for (const key of ALL_POOL_COLUMN_KEYS) {
      const value = source.columnVisibility[key];
      if (typeof value === "boolean") columnVisibility[key] = value;
    }
  }
  if (savedVersion < POOL_COLUMN_LAYOUT_VERSION) {
    for (const key of POOL_LEAD_FOLDED_COLUMN_KEYS) {
      columnVisibility[key] = DEFAULT_POOL_COLUMN_VISIBILITY[key];
    }
    columnVisibility.contact_info = true;
  }
  const fromSource = Array.isArray(source.columnOrder)
    ? source.columnOrder.filter(isPoolColumnKey)
    : [];
  return {
    columnVisibility,
    columnOrder: completeColumnOrder(fromSource, DEFAULT_POOL_COLUMN_ORDER),
    columnLayoutVersion: POOL_COLUMN_LAYOUT_VERSION,
  };
}

export function createDefaultPoolTableViewSettings(): PoolTableViewSettings {
  return {
    sourceFilter: "all",
    campaignFilter: "all",
    campaignIdFilter: "",
    contactFilter: "all",
    linkedinFilter: "all",
    dateAddedFilter: "all",
    headcountFilter: [],
    cityFilter: "",
    postcodeFilter: "",
    industryFilter: "",
    tagFilter: "all",
    excludeTags: [],
    sortField: "name",
    sortOrder: "asc",
    grouping: defaultPoolGrouping(),
    columnVisibility: { ...DEFAULT_POOL_COLUMN_VISIBILITY },
    columnOrder: [...DEFAULT_POOL_COLUMN_ORDER],
    columnLayoutVersion: POOL_COLUMN_LAYOUT_VERSION,
  };
}

function isPoolContactFilter(value: unknown): value is PoolContactFilter {
  return (
    value === "all" ||
    value === "email" ||
    value === "phone" ||
    value === "both" ||
    value === "none"
  );
}

function isPoolLinkedInFilter(value: unknown): value is PoolLinkedInFilter {
  return value === "all" || value === "has" || value === "none";
}

function normalizeHeadcountFilter(value: unknown): PoolHeadcountFilter {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, 40);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase() === "unknown" ? "unknown" : trimmed;
    if (out.some((existing) => existing.toLowerCase() === key.toLowerCase())) {
      continue;
    }
    out.push(key);
    if (out.length >= 12) break;
  }
  return out;
}

function normalizeExcludeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const tag = item.trim();
    if (!tag) continue;
    if (out.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      continue;
    }
    out.push(tag);
  }
  return out;
}

function normalizePlaceQuery(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 80);
}

function isPoolDateAddedFilter(value: unknown): value is PoolDateAddedFilter {
  return (
    value === "all" ||
    value === "today" ||
    value === "7d" ||
    value === "30d" ||
    value === "older_than_30d"
  );
}

export function normalizePoolTableViewSettings(
  raw: unknown
): PoolTableViewSettings {
  const defaults = createDefaultPoolTableViewSettings();
  const source =
    raw && typeof raw === "object"
      ? (raw as Partial<PoolTableViewSettings>)
      : {};
  const campaignFilter: PoolCampaignFilter =
    source.campaignFilter === "in_campaign" ||
    source.campaignFilter === "not_in_campaign"
      ? source.campaignFilter
      : "all";
  const columns = normalizeColumns(source);
  const tagFilter: PoolTagFilter =
    typeof source.tagFilter === "string" && source.tagFilter.trim()
      ? source.tagFilter.trim()
      : defaults.tagFilter;
  return {
    sourceFilter:
      typeof source.sourceFilter === "string" && source.sourceFilter.trim()
        ? source.sourceFilter
        : defaults.sourceFilter,
    campaignFilter,
    campaignIdFilter:
      typeof source.campaignIdFilter === "string"
        ? source.campaignIdFilter.trim().slice(0, 80)
        : "",
    contactFilter: isPoolContactFilter(source.contactFilter)
      ? source.contactFilter
      : defaults.contactFilter,
    linkedinFilter: isPoolLinkedInFilter(source.linkedinFilter)
      ? source.linkedinFilter
      : defaults.linkedinFilter,
    dateAddedFilter: isPoolDateAddedFilter(source.dateAddedFilter)
      ? source.dateAddedFilter
      : defaults.dateAddedFilter,
    headcountFilter: normalizeHeadcountFilter(source.headcountFilter),
    cityFilter: normalizePlaceQuery(source.cityFilter),
    postcodeFilter: normalizePlaceQuery(source.postcodeFilter),
    industryFilter: normalizePlaceQuery(source.industryFilter),
    tagFilter,
    excludeTags: normalizeExcludeTags(source.excludeTags),
    sortField: isPoolSortField(source.sortField)
      ? source.sortField
      : defaults.sortField,
    sortOrder: source.sortOrder === "desc" ? "desc" : "asc",
    grouping: normalizeGrouping(source.grouping),
    columnVisibility: columns.columnVisibility,
    columnOrder: columns.columnOrder,
    columnLayoutVersion: columns.columnLayoutVersion,
  };
}

export function poolTableViewSettingsEqual(
  a: PoolTableViewSettings,
  b: PoolTableViewSettings
): boolean {
  return (
    JSON.stringify(normalizePoolTableViewSettings(a)) ===
    JSON.stringify(normalizePoolTableViewSettings(b))
  );
}

export function createPoolTableView(
  name: string,
  settings: PoolTableViewSettings,
  options?: { id?: string; createdBy?: string; canEdit?: boolean }
): PoolTableView {
  return {
    id: options?.id ?? generateProspectTableViewId(),
    name,
    settings: normalizePoolTableViewSettings(settings),
    createdBy: options?.createdBy ?? "",
    canEdit: options?.canEdit ?? true,
  };
}

export function orderPoolTableViews(
  views: PoolTableView[],
  viewOrder: string[] = []
): PoolTableView[] {
  const allView = views.find((view) => isDefaultProspectTableViewName(view.name));
  const otherViews = views.filter(
    (view) => !isDefaultProspectTableViewName(view.name)
  );
  const byId = new Map(otherViews.map((view) => [view.id, view]));
  const ordered: PoolTableView[] = [];
  for (const id of viewOrder) {
    const view = byId.get(id);
    if (!view) continue;
    ordered.push(view);
    byId.delete(id);
  }
  for (const view of otherViews) {
    if (byId.has(view.id)) ordered.push(view);
  }
  return allView ? [allView, ...ordered] : ordered;
}

export function uniquePoolViewCopyName(
  sourceName: string,
  existingNames: string[]
): string {
  return uniqueProspectViewCopyName(sourceName, existingNames);
}

export function nonAllPoolViewOrder(views: PoolTableView[]): string[] {
  return views
    .filter((view) => !isDefaultProspectTableViewName(view.name))
    .map((view) => view.id);
}

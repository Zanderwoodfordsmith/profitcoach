/** Saved list views for the prospects table (filters, sort, grouping, columns). */

import {
  ALL_PROSPECT_COLUMN_KEYS,
  DEFAULT_PROSPECT_COLUMN_ORDER,
  DEFAULT_PROSPECT_COLUMN_VISIBILITY,
  PROSPECT_COLUMN_LEGACY_KEY_MAP,
  type ProspectColumnKey,
  type ProspectColumnVisibility,
} from "@/lib/prospects/prospectTableColumns";
import {
  defaultProspectGrouping,
  PROSPECT_GROUP_FIELDS,
  type PersistedProspectGrouping,
  type ProspectGroupField,
  type ProspectGroupOrder,
} from "@/lib/prospects/prospectGrouping";

export type ProspectTableViewSurface = "coach" | "admin";

export type ProspectListSortField =
  | "name"
  | "company"
  | "created_at"
  | "last_assessed"
  | "boss_score"
  | "next_call";

export type ProspectListSortOrder = "asc" | "desc";

export type ProspectAssessedFilter = "all" | "assessed" | "not_assessed";
export type ProspectCallFilter = "all" | "has_call" | "no_call";

export type ProspectTableViewSettings = {
  statusFilter: string;
  tagFilter: string;
  coachFilter: string;
  assessedFilter: ProspectAssessedFilter;
  callFilter: ProspectCallFilter;
  sortField: ProspectListSortField;
  sortOrder: ProspectListSortOrder;
  grouping: PersistedProspectGrouping;
  columnVisibility: ProspectColumnVisibility;
  columnOrder: ProspectColumnKey[];
};

export type ProspectTableView = {
  id: string;
  name: string;
  settings: ProspectTableViewSettings;
  createdBy: string;
  canEdit: boolean;
};

export type ProspectTableViewsStorage = {
  version: 1;
  views: ProspectTableView[];
  activeViewId: string;
  autosave: boolean;
  viewOrder: string[];
};

export type ProspectTableViewsPayload = {
  currentUserId: string;
  views: ProspectTableView[];
  activeViewId: string;
  autosave: boolean;
  viewOrder: string[];
};

export const DEFAULT_PROSPECT_TABLE_VIEW_NAME = "All";
export const PROSPECT_TABLE_VIEWS_MIGRATED_KEY = "pc-prospect-table-views-migrated-v1";
export const MAX_PROSPECT_TABLE_VIEW_NAME_LENGTH = 80;
export const MAX_PROSPECT_TABLE_VIEW_SETTINGS_BYTES = 32_768;

export const PROSPECT_LIST_SORT_FIELDS: ProspectListSortField[] = [
  "name",
  "company",
  "created_at",
  "last_assessed",
  "boss_score",
  "next_call",
];

export function isProspectTableViewSurface(
  value: unknown
): value is ProspectTableViewSurface {
  return value === "coach" || value === "admin";
}

export function isDefaultProspectTableViewName(name: string): boolean {
  return name.trim().toLowerCase() === DEFAULT_PROSPECT_TABLE_VIEW_NAME.toLowerCase();
}

export function isProspectListSortField(
  value: unknown
): value is ProspectListSortField {
  return (
    typeof value === "string" &&
    (PROSPECT_LIST_SORT_FIELDS as string[]).includes(value)
  );
}

export function isProspectListSortOrder(
  value: unknown
): value is ProspectListSortOrder {
  return value === "asc" || value === "desc";
}

export function createDefaultProspectTableViewSettings(): ProspectTableViewSettings {
  return {
    statusFilter: "all",
    tagFilter: "all",
    coachFilter: "",
    assessedFilter: "all",
    callFilter: "all",
    sortField: "name",
    sortOrder: "asc",
    grouping: defaultProspectGrouping(),
    columnVisibility: { ...DEFAULT_PROSPECT_COLUMN_VISIBILITY },
    columnOrder: [...DEFAULT_PROSPECT_COLUMN_ORDER],
  };
}

function asNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeGrouping(raw: unknown): PersistedProspectGrouping {
  const fallback = defaultProspectGrouping();
  if (!raw || typeof raw !== "object") return fallback;
  const parsed = raw as Partial<PersistedProspectGrouping>;
  const field = PROSPECT_GROUP_FIELDS.some((option) => option.key === parsed.field)
    ? (parsed.field as ProspectGroupField)
    : null;
  const order: ProspectGroupOrder =
    parsed.order === "desc" || parsed.order === "manual" ? parsed.order : "asc";
  const manualOrder: PersistedProspectGrouping["manualOrder"] = {};
  if (parsed.manualOrder && typeof parsed.manualOrder === "object") {
    for (const option of PROSPECT_GROUP_FIELDS) {
      const keys = parsed.manualOrder[option.key];
      if (!Array.isArray(keys)) continue;
      manualOrder[option.key] = keys.filter(
        (key): key is string => typeof key === "string" && key.length > 0
      );
    }
  }
  return { field, order, manualOrder };
}

function isProspectColumnKey(value: unknown): value is ProspectColumnKey {
  return (
    typeof value === "string" &&
    (ALL_PROSPECT_COLUMN_KEYS as readonly string[]).includes(value)
  );
}

function resolveColumnKey(rawKey: string): ProspectColumnKey | null {
  if (isProspectColumnKey(rawKey)) return rawKey;
  const mapped = PROSPECT_COLUMN_LEGACY_KEY_MAP[rawKey];
  return mapped ?? null;
}

function normalizeColumns(raw: {
  columnVisibility?: unknown;
  columnOrder?: unknown;
}): {
  columnVisibility: ProspectColumnVisibility;
  columnOrder: ProspectColumnKey[];
} {
  const columnVisibility = { ...DEFAULT_PROSPECT_COLUMN_VISIBILITY };
  if (raw.columnVisibility && typeof raw.columnVisibility === "object") {
    for (const [rawKey, value] of Object.entries(
      raw.columnVisibility as Record<string, unknown>
    )) {
      const key = resolveColumnKey(rawKey);
      if (key && typeof value === "boolean") {
        columnVisibility[key] = value;
      }
    }
  }

  const seen = new Set<ProspectColumnKey>();
  const columnOrder: ProspectColumnKey[] = [];
  const rawOrder = Array.isArray(raw.columnOrder) ? raw.columnOrder : [];
  for (const rawKey of rawOrder) {
    if (typeof rawKey !== "string") continue;
    const key = resolveColumnKey(rawKey);
    if (!key || seen.has(key)) continue;
    columnOrder.push(key);
    seen.add(key);
  }
  for (const key of DEFAULT_PROSPECT_COLUMN_ORDER) {
    if (!seen.has(key)) columnOrder.push(key);
  }

  return { columnVisibility, columnOrder };
}

export function normalizeProspectTableViewSettings(
  raw: unknown
): ProspectTableViewSettings {
  const defaults = createDefaultProspectTableViewSettings();
  const source =
    raw && typeof raw === "object"
      ? (raw as Partial<ProspectTableViewSettings>)
      : {};
  const assessedFilter: ProspectAssessedFilter =
    source.assessedFilter === "assessed" ||
    source.assessedFilter === "not_assessed"
      ? source.assessedFilter
      : "all";
  const callFilter: ProspectCallFilter =
    source.callFilter === "has_call" || source.callFilter === "no_call"
      ? source.callFilter
      : "all";
  const columns = normalizeColumns(source);
  return {
    statusFilter: asNonEmptyString(source.statusFilter, defaults.statusFilter),
    tagFilter: asNonEmptyString(source.tagFilter, defaults.tagFilter),
    coachFilter:
      typeof source.coachFilter === "string" ? source.coachFilter : "",
    assessedFilter,
    callFilter,
    sortField: isProspectListSortField(source.sortField)
      ? source.sortField
      : defaults.sortField,
    sortOrder: isProspectListSortOrder(source.sortOrder)
      ? source.sortOrder
      : defaults.sortOrder,
    grouping: normalizeGrouping(source.grouping),
    columnVisibility: columns.columnVisibility,
    columnOrder: columns.columnOrder,
  };
}

export function prospectTableViewSettingsEqual(
  a: ProspectTableViewSettings,
  b: ProspectTableViewSettings
): boolean {
  return (
    JSON.stringify(normalizeProspectTableViewSettings(a)) ===
    JSON.stringify(normalizeProspectTableViewSettings(b))
  );
}

export function generateProspectTableViewId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `view-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createProspectTableView(
  name: string,
  settings: ProspectTableViewSettings,
  options?: {
    id?: string;
    createdBy?: string;
    canEdit?: boolean;
  }
): ProspectTableView {
  const createdBy = options?.createdBy ?? "";
  return {
    id: options?.id ?? generateProspectTableViewId(),
    name,
    settings: normalizeProspectTableViewSettings(settings),
    createdBy,
    canEdit: options?.canEdit ?? true,
  };
}

export function pickCanonicalAllView(
  views: ProspectTableView[]
): ProspectTableView | null {
  return (
    views.find((view) => isDefaultProspectTableViewName(view.name)) ?? null
  );
}

export function orderProspectTableViews(
  views: ProspectTableView[],
  viewOrder: string[] = []
): ProspectTableView[] {
  const allView = pickCanonicalAllView(views);
  const otherViews = views.filter(
    (view) => !isDefaultProspectTableViewName(view.name)
  );
  const byId = new Map(otherViews.map((view) => [view.id, view]));
  const ordered: ProspectTableView[] = [];
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

export function nonAllProspectViewOrder(views: ProspectTableView[]): string[] {
  return views
    .filter((view) => !isDefaultProspectTableViewName(view.name))
    .map((view) => view.id);
}

import {
  DEFAULT_COACH_SORTS,
  type CoachSortCriterion,
  type CoachSortField,
  type CoachSortOrder,
  type CoachTableColumnVisibility,
  type CoachTableViewSettings,
} from "@/lib/admin/coachTableViews";

type LegacyCoachTableColumnVisibility = CoachTableColumnVisibility & {
  memberFor?: boolean;
};

export type CoachSortableRow = {
  full_name: string | null;
  joined_at: string | null;
  last_login_at: string | null;
  sales_robot_active_campaigns: number | null;
};

export const COACH_SORT_FIELD_OPTIONS: Array<{
  value: CoachSortField;
  label: string;
}> = [
  { value: "last_login", label: "Last login" },
  { value: "join_date", label: "Join date" },
  { value: "active_campaigns", label: "Active campaigns" },
];

export function coachSortOrderOptions(
  field: CoachSortField
): Array<{ value: CoachSortOrder; label: string }> {
  if (field === "join_date") {
    return [
      { value: "recent_first", label: "Newest first" },
      { value: "oldest_first", label: "Oldest first" },
      { value: "missing_first", label: "No join date first" },
    ];
  }
  if (field === "active_campaigns") {
    return [
      { value: "recent_first", label: "Most first" },
      { value: "oldest_first", label: "Least first" },
      { value: "missing_first", label: "Not set first" },
    ];
  }
  return [
    { value: "recent_first", label: "Most recent first" },
    { value: "oldest_first", label: "Oldest first" },
    { value: "missing_first", label: "Never logged in first" },
  ];
}

export function coachSortsEqual(
  a: CoachSortCriterion[],
  b: CoachSortCriterion[]
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isCoachSortField(value: unknown): value is CoachSortField {
  return (
    value === "last_login" ||
    value === "join_date" ||
    value === "active_campaigns"
  );
}

export function isCoachSortOrder(value: unknown): value is CoachSortOrder {
  return (
    value === "recent_first" ||
    value === "oldest_first" ||
    value === "missing_first"
  );
}

export function isCoachSortCriterion(value: unknown): value is CoachSortCriterion {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<CoachSortCriterion>;
  return isCoachSortField(row.field) && isCoachSortOrder(row.order);
}

export function parseCoachSortsFromPersisted(parsed: {
  sorts?: unknown;
  sortField?: unknown;
  sortOrder?: unknown;
  lastLoginSort?: unknown;
}): CoachSortCriterion[] {
  if (Array.isArray(parsed.sorts)) {
    const valid = parsed.sorts.filter(isCoachSortCriterion);
    if (valid.length > 0) return valid;
  }

  if (isCoachSortField(parsed.sortField) && isCoachSortOrder(parsed.sortOrder)) {
    return [{ field: parsed.sortField, order: parsed.sortOrder }];
  }

  const legacy = parsed.lastLoginSort;
  if (
    legacy === "recent_first" ||
    legacy === "oldest_first" ||
    legacy === "never_first"
  ) {
    return [
      {
        field: "last_login",
        order: legacy === "never_first" ? "missing_first" : legacy,
      },
    ];
  }

  return DEFAULT_COACH_SORTS;
}

export function compareCoachesByCriterion(
  a: CoachSortableRow,
  b: CoachSortableRow,
  { field, order }: CoachSortCriterion
): number {
  if (field === "active_campaigns") {
    const aCount = a.sales_robot_active_campaigns;
    const bCount = b.sales_robot_active_campaigns;
    const aHas = aCount != null;
    const bHas = bCount != null;
    if (order === "missing_first") {
      if (aHas !== bHas) return aHas ? 1 : -1;
      if (!aHas && !bHas) return 0;
    } else if (aHas !== bHas) {
      return aHas ? -1 : 1;
    }
    if (!aHas && !bHas) return 0;
    const aVal = aCount ?? 0;
    const bVal = bCount ?? 0;
    if (order === "oldest_first") return aVal - bVal;
    return bVal - aVal;
  }

  const aIso = field === "join_date" ? a.joined_at : a.last_login_at;
  const bIso = field === "join_date" ? b.joined_at : b.last_login_at;
  const aMs = aIso ? Date.parse(aIso) : Number.NaN;
  const bMs = bIso ? Date.parse(bIso) : Number.NaN;
  const aHas = !Number.isNaN(aMs);
  const bHas = !Number.isNaN(bMs);
  if (order === "missing_first") {
    if (aHas !== bHas) return aHas ? 1 : -1;
    if (!aHas && !bHas) return 0;
  } else if (aHas !== bHas) {
    return aHas ? -1 : 1;
  }
  if (!aHas && !bHas) return 0;
  if (order === "oldest_first") return aMs - bMs;
  return bMs - aMs;
}

export function compareCoachesBySorts(
  a: CoachSortableRow,
  b: CoachSortableRow,
  sorts: CoachSortCriterion[]
): number {
  for (const criterion of sorts) {
    const cmp = compareCoachesByCriterion(a, b, criterion);
    if (cmp !== 0) return cmp;
  }
  return (a.full_name ?? "").localeCompare(b.full_name ?? "");
}

export function nextUnusedCoachSortField(
  sorts: CoachSortCriterion[]
): CoachSortField | null {
  const used = new Set(sorts.map((sort) => sort.field));
  return (
    COACH_SORT_FIELD_OPTIONS.find((option) => !used.has(option.value))?.value ??
    null
  );
}

function migrateCoachTableColumns(
  settings: CoachTableViewSettings
): Pick<CoachTableViewSettings, "columnVisibility" | "columnOrder"> {
  const legacyVisibility =
    settings.columnVisibility as LegacyCoachTableColumnVisibility;
  const legacyMemberFor = legacyVisibility.memberFor;
  const { memberFor: _removed, ...columnVisibility } = legacyVisibility;
  void _removed;

  if (legacyMemberFor === true) {
    columnVisibility.joinDate = true;
  } else if (
    legacyMemberFor === false &&
    columnVisibility.joinDate === undefined
  ) {
    columnVisibility.joinDate = false;
  }

  const columnOrder = (
    settings.columnOrder as Array<keyof CoachTableColumnVisibility | "memberFor">
  ).filter((key): key is keyof CoachTableColumnVisibility => key !== "memberFor");

  return { columnVisibility, columnOrder };
}

export function normalizeCoachTableViewSettings(
  settings: CoachTableViewSettings & {
    sortField?: unknown;
    sortOrder?: unknown;
    lastLoginSort?: unknown;
  }
): CoachTableViewSettings {
  const sorts =
    Array.isArray(settings.sorts) && settings.sorts.length > 0
      ? settings.sorts.filter(isCoachSortCriterion)
      : parseCoachSortsFromPersisted(settings);
  const { columnVisibility, columnOrder } = migrateCoachTableColumns(settings);
  return {
    ...settings,
    sorts: sorts.length > 0 ? sorts : DEFAULT_COACH_SORTS,
    columnVisibility,
    columnOrder,
  };
}

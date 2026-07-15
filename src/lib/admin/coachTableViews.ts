/** Saved table views for the admin coaches list (filters, sort, columns, search). */

export type ConferenceFilter = "all" | "yes" | "maybe" | "no" | "not_set";
export type CrmNameFilter = "all" | "has_name" | "no_name";
export type LastLoginFilter =
  | "all"
  | "has_login"
  | "never"
  | "last_30_days"
  | "over_90_days";
export type SalesRobotFilter =
  | "all"
  | "has_sales_robot"
  | "no_sales_robot"
  | "paying"
  | "not_paying"
  | "active_campaigns";
export type RecurringBillingFilter = "all" | "active" | "inactive";
export type CoachSortField = "last_login" | "join_date" | "active_campaigns";
export type CoachSortOrder = "recent_first" | "oldest_first" | "missing_first";

export type CoachSortCriterion = {
  field: CoachSortField;
  order: CoachSortOrder;
};

export const DEFAULT_COACH_SORTS: CoachSortCriterion[] = [
  { field: "join_date", order: "recent_first" },
];

export type CoachTableColumnVisibility = {
  slug: boolean;
  email: boolean;
  joinDate: boolean;
  goalLevel: boolean;
  clients: boolean;
  linkedinProfile: boolean;
  directory: boolean;
  certification: boolean;
  conference: boolean;
  currentLevel: boolean;
  goalBy: boolean;
  lastLogin: boolean;
  crm: boolean;
  salesRobot: boolean;
  activeCampaigns: boolean;
  payingAccounts: boolean;
  profitCoachEmail: boolean;
  accessTier: boolean;
  recurringPayment: boolean;
  recurringActive: boolean;
  payments: boolean;
  calendarEmbed: boolean;
  leadWebhook: boolean;
  communityBio: boolean;
  directorySummary: boolean;
  directoryBio: boolean;
  landing: boolean;
};

export type CoachTableViewSettings = {
  conferenceFilter: ConferenceFilter;
  crmNameFilter: CrmNameFilter;
  lastLoginFilter: LastLoginFilter;
  salesRobotFilter: SalesRobotFilter;
  recurringBillingFilter: RecurringBillingFilter;
  joinDateAfter: string;
  joinDateBefore: string;
  sorts: CoachSortCriterion[];
  columnVisibility: CoachTableColumnVisibility;
  columnOrder: Array<keyof CoachTableColumnVisibility>;
  searchTerm: string;
};

export type CoachTableView = {
  id: string;
  name: string;
  settings: CoachTableViewSettings;
  createdBy: string;
  isPrivate: boolean;
  canEdit: boolean;
};

export type CoachTableViewsStorage = {
  version: 1;
  views: CoachTableView[];
  activeViewId: string;
  autosave: boolean;
  viewOrder: string[];
};

export type CoachTableViewsPayload = {
  currentUserId: string;
  views: CoachTableView[];
  activeViewId: string;
  autosave: boolean;
  /** Preferred order of non-All view ids for this admin. All is always first. */
  viewOrder: string[];
};

export const COACH_TABLE_VIEWS_STORAGE_KEY = "admin-coaches-table-views-v1";
export const LEGACY_COACH_TABLE_SETTINGS_KEY = "admin-coaches-table-settings-v2";
export const COACH_TABLE_VIEWS_MIGRATED_KEY =
  "admin-coaches-table-views-migrated-v1";

export const DEFAULT_COACH_TABLE_VIEW_NAME = "All";
/** Older default tab name; still recognized as the system All view. */
export const LEGACY_DEFAULT_COACH_TABLE_VIEW_NAME = "All coaches";

export function isDefaultCoachTableViewName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return (
    normalized === DEFAULT_COACH_TABLE_VIEW_NAME.toLowerCase() ||
    normalized === LEGACY_DEFAULT_COACH_TABLE_VIEW_NAME.toLowerCase()
  );
}

export function pickCanonicalAllView(
  views: CoachTableView[]
): CoachTableView | null {
  const allViews = views.filter((view) => isDefaultCoachTableViewName(view.name));
  if (allViews.length === 0) return null;
  return (
    allViews.find(
      (view) =>
        view.name.trim().toLowerCase() ===
        DEFAULT_COACH_TABLE_VIEW_NAME.toLowerCase()
    ) ?? allViews[0]
  );
}

/** All is always first; remaining tabs follow `viewOrder`, then created order. */
export function orderCoachTableViews(
  views: CoachTableView[],
  viewOrder: string[] = []
): CoachTableView[] {
  const allView = pickCanonicalAllView(views);
  const otherViews = views.filter(
    (view) => !isDefaultCoachTableViewName(view.name)
  );
  const byId = new Map(otherViews.map((view) => [view.id, view]));
  const ordered: CoachTableView[] = [];
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

export function sortCoachTableViewsWithAllFirst(
  views: CoachTableView[]
): CoachTableView[] {
  return orderCoachTableViews(views, []);
}

export const DEFAULT_COACH_TABLE_COLUMN_ORDER: Array<
  keyof CoachTableColumnVisibility
> = [
  "slug",
  "email",
  "joinDate",
  "clients",
  "linkedinProfile",
  "conference",
  "lastLogin",
  "goalLevel",
  "currentLevel",
  "goalBy",
  "directory",
  "certification",
  "communityBio",
  "directorySummary",
  "directoryBio",
  "crm",
  "calendarEmbed",
  "leadWebhook",
  "salesRobot",
  "activeCampaigns",
  "payingAccounts",
  "profitCoachEmail",
  "accessTier",
  "recurringPayment",
  "recurringActive",
  "payments",
  "landing",
];

export const DEFAULT_COACH_TABLE_COLUMNS: CoachTableColumnVisibility = {
  slug: true,
  email: true,
  joinDate: true,
  goalLevel: true,
  clients: true,
  linkedinProfile: true,
  directory: true,
  certification: true,
  conference: true,
  currentLevel: true,
  goalBy: true,
  lastLogin: true,
  crm: true,
  salesRobot: true,
  activeCampaigns: true,
  payingAccounts: true,
  profitCoachEmail: true,
  accessTier: true,
  recurringPayment: true,
  recurringActive: true,
  payments: true,
  calendarEmbed: true,
  leadWebhook: true,
  communityBio: true,
  directorySummary: true,
  directoryBio: true,
  landing: true,
};

export function createDefaultCoachTableViewSettings(): CoachTableViewSettings {
  return {
    conferenceFilter: "all",
    crmNameFilter: "all",
    lastLoginFilter: "all",
    salesRobotFilter: "all",
    recurringBillingFilter: "all",
    joinDateAfter: "",
    joinDateBefore: "",
    sorts: DEFAULT_COACH_SORTS,
    columnVisibility: DEFAULT_COACH_TABLE_COLUMNS,
    columnOrder: DEFAULT_COACH_TABLE_COLUMN_ORDER,
    searchTerm: "",
  };
}

export function generateCoachTableViewId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `view-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function coachTableViewSettingsEqual(
  a: CoachTableViewSettings,
  b: CoachTableViewSettings
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createCoachTableView(
  name: string,
  settings: CoachTableViewSettings,
  options?: {
    id?: string;
    createdBy?: string;
    isPrivate?: boolean;
    canEdit?: boolean;
  }
): CoachTableView {
  const createdBy = options?.createdBy ?? "";
  return {
    id: options?.id ?? generateCoachTableViewId(),
    name,
    settings,
    createdBy,
    isPrivate: options?.isPrivate ?? false,
    canEdit: options?.canEdit ?? createdBy !== "",
  };
}

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
  { field: "last_login", order: "recent_first" },
];

export type CoachTableColumnVisibility = {
  slug: boolean;
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
};

export type CoachTableViewsStorage = {
  version: 1;
  views: CoachTableView[];
  activeViewId: string;
  autosave: boolean;
};

export const COACH_TABLE_VIEWS_STORAGE_KEY = "admin-coaches-table-views-v1";
export const LEGACY_COACH_TABLE_SETTINGS_KEY = "admin-coaches-table-settings-v2";

export const DEFAULT_COACH_TABLE_VIEW_NAME = "All coaches";

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
  settings: CoachTableViewSettings
): CoachTableView {
  return {
    id: generateCoachTableViewId(),
    name,
    settings,
  };
}

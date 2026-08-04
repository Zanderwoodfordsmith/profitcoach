/** Workspace tabs under /coach/clients/[id]. */
export const CLIENT_WORKSPACE_TABS = [
  "overview",
  "plan",
  "ninety-day",
  "revenue",
  "expenses",
  "team",
  "notes",
] as const;

export type ClientWorkspaceTab = (typeof CLIENT_WORKSPACE_TABS)[number];

export type YearTargets = {
  revenue: string;
  profit: string;
  qualitative: string;
};

export type OrbitAreaId =
  | "reach"
  | "enrol"
  | "deliver"
  | "income"
  | "impact"
  | "freedom";

export type OrbitAreaNote = {
  areaId: OrbitAreaId;
  /** Where they are now */
  now: string;
  /** Year-3 destination */
  target: string;
};

export type QuarterKey =
  | "y1q1"
  | "y1q2"
  | "y1q3"
  | "y1q4"
  | "y2q1"
  | "y2q2"
  | "y2q3"
  | "y2q4"
  | "y3q1"
  | "y3q2"
  | "y3q3"
  | "y3q4";

export type QuarterSpineItem = {
  key: QuarterKey;
  /** Short focus for the quarter */
  focus: string;
  /** Optional metric / outcome */
  outcome: string;
};

export type NinetyDayItemStatus = "todo" | "doing" | "done";

/** Week within the 90-day / quarter window (1–13). */
export type NinetyDayWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type NinetyDayItem = {
  id: string;
  title: string;
  notes: string;
  status: NinetyDayItemStatus;
  /** Timeline placement; null = backlog / unscheduled */
  week: NinetyDayWeek | null;
  sortOrder: number;
};

export type CoachingPlanDocument = {
  version: 1;
  northStar: string;
  years: {
    year1: YearTargets;
    year2: YearTargets;
    year3: YearTargets;
  };
  orbit: OrbitAreaNote[];
  quarters: QuarterSpineItem[];
  /** Which quarter is “current” for 90-day handoff */
  currentQuarterKey: QuarterKey;
  /** 90-day actions keyed by quarter (shared with 3-year spine) */
  ninetyDayByQuarter: Partial<Record<QuarterKey, NinetyDayItem[]>>;
  updatedAt: string | null;
};

export type ClientWorkspaceContact = {
  id: string;
  fullName: string;
  email: string | null;
  businessName: string | null;
  type: string;
};

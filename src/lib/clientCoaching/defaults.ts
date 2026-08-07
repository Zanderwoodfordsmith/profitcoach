import type {
  ClientWorkspaceTab,
  CoachingPlanDocument,
  OrbitAreaId,
  OrbitAreaNote,
  QuarterKey,
  QuarterSpineItem,
  YearTargets,
} from "./types";

export const ORBIT_AREA_META: {
  id: OrbitAreaId;
  label: string;
  group: "business" | "lifestyle";
  hint: string;
}[] = [
  {
    id: "reach",
    label: "Get Calls",
    group: "business",
    hint: "Pipeline, positioning, and lead engine.",
  },
  {
    id: "enrol",
    label: "Win Clients",
    group: "business",
    hint: "Offer, value sessions, and closing.",
  },
  {
    id: "deliver",
    label: "Coach Clients",
    group: "business",
    hint: "Launch, method, and retention.",
  },
  {
    id: "income",
    label: "Income",
    group: "lifestyle",
    hint: "Revenue level that matches the goals.",
  },
  {
    id: "impact",
    label: "Impact",
    group: "lifestyle",
    hint: "Client results you can point to.",
  },
  {
    id: "freedom",
    label: "Freedom",
    group: "lifestyle",
    hint: "Business fits life, not the other way around.",
  },
];

export const QUARTER_META: {
  key: QuarterKey;
  year: 1 | 2 | 3;
  quarter: 1 | 2 | 3 | 4;
  label: string;
}[] = [
  { key: "y1q1", year: 1, quarter: 1, label: "Y1 · Q1" },
  { key: "y1q2", year: 1, quarter: 2, label: "Y1 · Q2" },
  { key: "y1q3", year: 1, quarter: 3, label: "Y1 · Q3" },
  { key: "y1q4", year: 1, quarter: 4, label: "Y1 · Q4" },
  { key: "y2q1", year: 2, quarter: 1, label: "Y2 · Q1" },
  { key: "y2q2", year: 2, quarter: 2, label: "Y2 · Q2" },
  { key: "y2q3", year: 2, quarter: 3, label: "Y2 · Q3" },
  { key: "y2q4", year: 2, quarter: 4, label: "Y2 · Q4" },
  { key: "y3q1", year: 3, quarter: 1, label: "Y3 · Q1" },
  { key: "y3q2", year: 3, quarter: 2, label: "Y3 · Q2" },
  { key: "y3q3", year: 3, quarter: 3, label: "Y3 · Q3" },
  { key: "y3q4", year: 3, quarter: 4, label: "Y3 · Q4" },
];

function emptyYear(): YearTargets {
  return { revenue: "", profit: "", qualitative: "" };
}

function emptyOrbit(): OrbitAreaNote[] {
  return ORBIT_AREA_META.map((a) => ({
    areaId: a.id,
    now: "",
    target: "",
  }));
}

function emptyQuarters(): QuarterSpineItem[] {
  return QUARTER_META.map((q) => ({
    key: q.key,
    focus: "",
    outcome: "",
  }));
}

export function createEmptyCoachingPlan(): CoachingPlanDocument {
  return {
    version: 1,
    northStar: "",
    years: {
      year1: emptyYear(),
      year2: emptyYear(),
      year3: emptyYear(),
    },
    orbit: emptyOrbit(),
    quarters: emptyQuarters(),
    currentQuarterKey: "y1q1",
    ninetyDayByQuarter: {},
    updatedAt: null,
  };
}

export function newNinetyDayItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `nd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clientWorkspacePath(
  contactId: string,
  tab?: string,
  options?: { admin?: boolean }
): string {
  const base = options?.admin
    ? `/admin/clients/${encodeURIComponent(contactId)}`
    : `/coach/clients/${encodeURIComponent(contactId)}`;
  if (!tab || tab === "overview") return base;
  return `${base}?tab=${encodeURIComponent(tab)}`;
}

/** Hub entry when no client is selected yet. */
export function clientCoachingHubPath(
  tab?: string,
  options?: { admin?: boolean; contactId?: string | null }
): string {
  const prefix = options?.admin ? "/admin" : "/coach";
  if (options?.contactId) {
    return clientWorkspacePath(options.contactId, tab, {
      admin: options.admin,
    });
  }
  const base = `${prefix}/clients/coaching`;
  if (!tab || tab === "overview") return base;
  return `${base}?tab=${encodeURIComponent(tab)}`;
}

export const LAST_CLIENT_WORKSPACE_KEY = "coach-clients-last-contact-id";

export const CLIENT_WORKSPACE_TAB_LABELS: {
  id: ClientWorkspaceTab;
  label: string;
}[] = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "3-Year Plan" },
  { id: "ninety-day", label: "90-Day" },
  { id: "revenue", label: "Revenue" },
  { id: "expenses", label: "Expenses" },
  { id: "team", label: "Team" },
  { id: "notes", label: "Notes" },
];


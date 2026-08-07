import { createEmptyCoachingPlan, ORBIT_AREA_META, QUARTER_META } from "./defaults";
import type {
  CoachingPlanDocument,
  NinetyDayItem,
  NinetyDayItemStatus,
  NinetyDayWeek,
  OrbitAreaId,
  OrbitAreaNote,
  QuarterKey,
  QuarterSpineItem,
  YearTargets,
} from "./types";
import { CLIENT_WORKSPACE_TABS, type ClientWorkspaceTab } from "./types";

const STATUSES = new Set<NinetyDayItemStatus>(["todo", "doing", "done"]);

const ORBIT_IDS = new Set<OrbitAreaId>(ORBIT_AREA_META.map((a) => a.id));
const QUARTER_KEYS = new Set<QuarterKey>(QUARTER_META.map((q) => q.key));

function asString(value: unknown, max = 4000): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

function normalizeYear(raw: unknown): YearTargets {
  const empty = { revenue: "", profit: "", qualitative: "" };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const o = raw as Record<string, unknown>;
  return {
    revenue: asString(o.revenue, 200),
    profit: asString(o.profit, 200),
    qualitative: asString(o.qualitative, 2000),
  };
}

function normalizeOrbit(raw: unknown): OrbitAreaNote[] {
  const byId = new Map<OrbitAreaId, OrbitAreaNote>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const o = item as Record<string, unknown>;
      const areaId = o.areaId;
      if (typeof areaId !== "string" || !ORBIT_IDS.has(areaId as OrbitAreaId)) {
        continue;
      }
      byId.set(areaId as OrbitAreaId, {
        areaId: areaId as OrbitAreaId,
        now: asString(o.now, 2000),
        target: asString(o.target, 2000),
      });
    }
  }
  return ORBIT_AREA_META.map(
    (a) => byId.get(a.id) ?? { areaId: a.id, now: "", target: "" }
  );
}

function normalizeQuarters(raw: unknown): QuarterSpineItem[] {
  const byKey = new Map<QuarterKey, QuarterSpineItem>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const o = item as Record<string, unknown>;
      const key = o.key;
      if (typeof key !== "string" || !QUARTER_KEYS.has(key as QuarterKey)) {
        continue;
      }
      byKey.set(key as QuarterKey, {
        key: key as QuarterKey,
        focus: asString(o.focus, 1000),
        outcome: asString(o.outcome, 1000),
      });
    }
  }
  return QUARTER_META.map(
    (q) => byKey.get(q.key) ?? { key: q.key, focus: "", outcome: "" }
  );
}

function normalizeWeek(raw: unknown): NinetyDayWeek | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  if (n < 1 || n > 13) return null;
  return n as NinetyDayWeek;
}

function normalizeNinetyDayItems(raw: unknown): NinetyDayItem[] {
  if (!Array.isArray(raw)) return [];
  const items: NinetyDayItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const id = asString(o.id, 80) || `nd-${i}`;
    const status =
      typeof o.status === "string" && STATUSES.has(o.status as NinetyDayItemStatus)
        ? (o.status as NinetyDayItemStatus)
        : "todo";
    const sortOrder =
      typeof o.sortOrder === "number" && Number.isFinite(o.sortOrder)
        ? o.sortOrder
        : i;
    items.push({
      id,
      title: asString(o.title, 500),
      notes: asString(o.notes, 4000),
      status,
      week: normalizeWeek(o.week),
      sortOrder,
    });
  }
  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeNinetyDayByQuarter(
  raw: unknown
): Partial<Record<QuarterKey, NinetyDayItem[]>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<QuarterKey, NinetyDayItem[]>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!QUARTER_KEYS.has(key as QuarterKey)) continue;
    out[key as QuarterKey] = normalizeNinetyDayItems(value);
  }
  return out;
}

export function normalizeCoachingPlan(raw: unknown): CoachingPlanDocument {
  const base = createEmptyCoachingPlan();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;

  const o = raw as Record<string, unknown>;
  const yearsRaw =
    o.years && typeof o.years === "object" && !Array.isArray(o.years)
      ? (o.years as Record<string, unknown>)
      : {};

  const currentQuarterKey =
    typeof o.currentQuarterKey === "string" &&
    QUARTER_KEYS.has(o.currentQuarterKey as QuarterKey)
      ? (o.currentQuarterKey as QuarterKey)
      : base.currentQuarterKey;

  return {
    version: 1,
    northStar: asString(o.northStar, 2000),
    years: {
      year1: normalizeYear(yearsRaw.year1),
      year2: normalizeYear(yearsRaw.year2),
      year3: normalizeYear(yearsRaw.year3),
    },
    orbit: normalizeOrbit(o.orbit),
    quarters: normalizeQuarters(o.quarters),
    currentQuarterKey,
    ninetyDayByQuarter: normalizeNinetyDayByQuarter(o.ninetyDayByQuarter),
    updatedAt:
      typeof o.updatedAt === "string" && o.updatedAt.trim()
        ? o.updatedAt.slice(0, 64)
        : null,
  };
}

export function parseClientWorkspaceTab(
  raw: string | null | undefined
): ClientWorkspaceTab {
  if (raw && (CLIENT_WORKSPACE_TABS as readonly string[]).includes(raw)) {
    return raw as ClientWorkspaceTab;
  }
  return "overview";
}

import fs from "node:fs";
import path from "node:path";

export type WeeklyFocusWeek = {
  id: string;
  weekOfYear: number;
  pathId: string;
  pathLabel: string;
  title: string;
  description: string;
  action: string;
  bodyMarkdown?: string;
  audioUrl?: string | null;
};

export type WeeklyFocusCatalog = {
  coverImageUrl: string;
  weeks: WeeklyFocusWeek[];
};

const WEEKLY_FOCUS_PATH = path.join(
  process.cwd(),
  "content/academy/weekly-focus.json",
);

export function loadWeeklyFocusCatalog(): WeeklyFocusCatalog {
  const raw = fs.readFileSync(WEEKLY_FOCUS_PATH, "utf8");
  const data = JSON.parse(raw) as WeeklyFocusCatalog;
  if (!Array.isArray(data.weeks) || data.weeks.length === 0) {
    throw new Error("weekly-focus.json: expected non-empty weeks array");
  }
  return data;
}

export function isoWeekNumber(date: Date = new Date()): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function findWeeklyFocusById(
  catalog: WeeklyFocusCatalog,
  weekId: string,
): WeeklyFocusWeek | null {
  return catalog.weeks.find((week) => week.id === weekId) ?? null;
}

export function getCurrentWeeklyFocus(
  catalog: WeeklyFocusCatalog,
  date: Date = new Date(),
): WeeklyFocusWeek {
  const weekOfYear = isoWeekNumber(date);
  const exact = catalog.weeks.find((week) => week.weekOfYear === weekOfYear);
  if (exact) return exact;

  const sorted = [...catalog.weeks].sort((a, b) => a.weekOfYear - b.weekOfYear);
  const earlier = [...sorted].reverse().find((week) => week.weekOfYear <= weekOfYear);
  return earlier ?? sorted[sorted.length - 1]!;
}

export function getPastWeeklyFocuses(
  catalog: WeeklyFocusCatalog,
  currentId: string,
): WeeklyFocusWeek[] {
  const current = findWeeklyFocusById(catalog, currentId) ?? getCurrentWeeklyFocus(catalog);
  return [...catalog.weeks]
    .filter((week) => week.id !== current.id)
    .sort((a, b) => b.weekOfYear - a.weekOfYear);
}

export function weeklyFocusHref(basePath: string, weekId?: string): string {
  const root = `${basePath}/weekly-focus`;
  return weekId ? `${root}/${encodeURIComponent(weekId)}` : root;
}

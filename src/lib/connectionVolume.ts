import type { FunnelStatus } from "@/lib/funnelCompute";

/** Pace bands: green above this per week, yellow from 100 up to and including 150, red below 100. */
export const CR_GREEN_MIN_PER_WEEK = 150;
export const CR_YELLOW_MIN_PER_WEEK = 100;

/** Full width of the connection-requests slider = this × weeks (goal tick at 75% = 150/wk pace). */
export const CR_BAR_MAX_PER_WEEK = 200;

export function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalYMD(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

/** Inclusive calendar days from start through end. */
export function inclusiveDays(startStr: string, endStr: string): number | null {
  if (!startStr.trim() || !endStr.trim()) return null;
  const a = parseLocalYMD(startStr);
  const b = parseLocalYMD(endStr);
  if (!a || !b) return null;
  const diff = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  if (diff < 0) return null;
  return diff + 1;
}

/** Weeks = inclusive days ÷ 7. */
export function weeksFromInclusiveDays(days: number): number {
  return days / 7;
}

/** Connection requests per week (total ÷ weeks). */
export function connectionRequestsPerWeek(
  total: number,
  weeks: number,
): number {
  if (weeks <= 0 || !Number.isFinite(weeks)) return 0;
  return total / weeks;
}

export function connectionVolumeStatus(perWeek: number): FunnelStatus {
  if (!Number.isFinite(perWeek) || perWeek < 0) return "na";
  if (perWeek > CR_GREEN_MIN_PER_WEEK) return "green";
  if (perWeek >= CR_YELLOW_MIN_PER_WEEK) return "yellow";
  return "red";
}

/** Minimum total CRs for “green” pace at 150/week over this window. */
export function greenFloorTotal(weeks: number): number {
  if (weeks <= 0) return 0;
  return CR_GREEN_MIN_PER_WEEK * weeks;
}

/** Minimum total CRs for “yellow” floor at 100/week. */
export function yellowFloorTotal(weeks: number): number {
  if (weeks <= 0) return 0;
  return CR_YELLOW_MIN_PER_WEEK * weeks;
}

/** Default end = today, start = 29 days earlier → 30 inclusive days. */
export function defaultLast30DayWindow(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: toLocalYMD(start), end: toLocalYMD(end) };
}

export const WAIT_UNITS = ["minutes", "hours", "days", "weeks"] as const;
export type WaitUnit = (typeof WAIT_UNITS)[number];

const MINUTES_PER: Record<WaitUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
  weeks: 60 * 24 * 7,
};

export const WAIT_UNIT_MAX: Record<WaitUnit, number> = {
  minutes: 24 * 60,
  hours: 24 * 7,
  days: 90,
  weeks: 12,
};

export const MIN_WAIT_HOURS = 1 / 60;
export const MAX_WAIT_HOURS = 90 * 24;

export function clampWaitHours(hours: number): number {
  if (!Number.isFinite(hours)) return 24;
  const rounded = Math.round(hours * 10000) / 10000;
  return Math.min(MAX_WAIT_HOURS, Math.max(MIN_WAIT_HOURS, rounded));
}

export function waitToHours(amount: number, unit: WaitUnit): number {
  const n = Number.isFinite(amount) ? amount : 1;
  const minutes = Math.max(1, Math.round(n)) * MINUTES_PER[unit];
  return clampWaitHours(minutes / 60);
}

export function inferWaitDuration(hours: number | null | undefined): {
  amount: number;
  unit: WaitUnit;
} {
  const minutes = Math.max(1, Math.round(clampWaitHours(hours ?? 24) * 60));
  if (minutes >= MINUTES_PER.weeks && minutes % MINUTES_PER.weeks === 0) {
    return { amount: minutes / MINUTES_PER.weeks, unit: "weeks" };
  }
  if (minutes >= MINUTES_PER.days && minutes % MINUTES_PER.days === 0) {
    return { amount: minutes / MINUTES_PER.days, unit: "days" };
  }
  if (minutes >= MINUTES_PER.hours && minutes % MINUTES_PER.hours === 0) {
    return { amount: minutes / MINUTES_PER.hours, unit: "hours" };
  }
  return { amount: minutes, unit: "minutes" };
}

export function formatWaitDuration(hours: number | null | undefined): string {
  const { amount, unit } = inferWaitDuration(hours);
  const singular: Record<WaitUnit, string> = {
    minutes: "minute",
    hours: "hour",
    days: "day",
    weeks: "week",
  };
  const label = amount === 1 ? singular[unit] : unit;
  return `${amount} ${label}`;
}

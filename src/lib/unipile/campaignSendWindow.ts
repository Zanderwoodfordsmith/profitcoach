import {
  addDaysYmd,
  parseTimeToMinutes,
  utcToZonedParts,
  zonedLocalToUtc,
} from "@/lib/booking/bookingTime";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";

export const DAILY_INVITE_LIMIT_MAX = 250;
export const DAILY_INVITE_LIMIT_WARN = 200;
export const DAILY_MESSAGE_LIMIT_MAX = 100;
export const DAILY_REACT_LIMIT_MAX = 100;
export const DAILY_LIMIT_MIN = 1;

/** Mon–Fri 07:00–18:00 in the campaign timezone. */
export const DEFAULT_CAMPAIGN_SEND_RULES: AvailabilityRuleRow[] = [
  { weekday: 1, start_time: "07:00", end_time: "18:00" },
  { weekday: 2, start_time: "07:00", end_time: "18:00" },
  { weekday: 3, start_time: "07:00", end_time: "18:00" },
  { weekday: 4, start_time: "07:00", end_time: "18:00" },
  { weekday: 5, start_time: "07:00", end_time: "18:00" },
];

const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export function normalizeClock(value: string): string | null {
  const match = String(value || "").trim().match(CLOCK_RE);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

export function parseCampaignSendRules(value: unknown): AvailabilityRuleRow[] {
  if (!Array.isArray(value)) return DEFAULT_CAMPAIGN_SEND_RULES.map((r) => ({ ...r }));
  const byDay = new Map<number, AvailabilityRuleRow>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const weekday = Number(row.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
    const start = normalizeClock(String(row.start_time ?? ""));
    const end = normalizeClock(String(row.end_time ?? ""));
    if (!start || !end) continue;
    if (parseTimeToMinutes(end) <= parseTimeToMinutes(start)) continue;
    byDay.set(weekday, { weekday, start_time: start, end_time: end });
  }
  return [...byDay.values()].sort((a, b) => a.weekday - b.weekday);
}

export function clampDailyLimit(
  value: unknown,
  max: number,
  fallback: number
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(DAILY_LIMIT_MIN, Math.round(n)));
}

export function startOfZonedDay(now: Date, timeZone: string): Date {
  const parts = utcToZonedParts(now, timeZone);
  return zonedLocalToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    timeZone,
  });
}

function localDateParts(
  year: number,
  month: number,
  day: number,
  timeZone: string
) {
  const noon = zonedLocalToUtc({
    year,
    month,
    day,
    hour: 12,
    minute: 0,
    timeZone,
  });
  return utcToZonedParts(noon, timeZone);
}

export function nextCampaignSendAt(input: {
  now?: Date;
  timezone?: string | null;
  rules: unknown;
  afterCurrentWindow?: boolean;
}): Date {
  const now = input.now ?? new Date();
  const timeZone = input.timezone?.trim() || "Europe/London";
  const rules = parseCampaignSendRules(input.rules);
  if (rules.length === 0) {
    return new Date(now.getTime() + 24 * 3600 * 1000);
  }

  const startParts = utcToZonedParts(now, timeZone);
  const nowMinutes = startParts.hour * 60 + startParts.minute;
  const ymd0 = `${startParts.year}-${String(startParts.month).padStart(2, "0")}-${String(startParts.day).padStart(2, "0")}`;

  for (let offset = 0; offset < 8; offset += 1) {
    const [year, month, day] = addDaysYmd(ymd0, offset)
      .split("-")
      .map(Number);
    const probe = localDateParts(year, month, day, timeZone);
    const rule = rules.find((r) => r.weekday === probe.weekday);
    if (!rule) continue;
    const start = parseTimeToMinutes(rule.start_time);
    const startHour = Math.floor(start / 60);
    const startMinute = start % 60;
    const atStart = zonedLocalToUtc({
      year: probe.year,
      month: probe.month,
      day: probe.day,
      hour: startHour,
      minute: startMinute,
      timeZone,
    });

    if (offset === 0) {
      const end = parseTimeToMinutes(rule.end_time);
      if (!input.afterCurrentWindow && nowMinutes >= start && nowMinutes < end) {
        return now;
      }
      if (!input.afterCurrentWindow && nowMinutes < start) {
        return atStart;
      }
      continue;
    }

    return atStart;
  }

  return new Date(now.getTime() + 24 * 3600 * 1000);
}

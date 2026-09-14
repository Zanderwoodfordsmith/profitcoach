import {
  addDaysYmd,
  utcToZonedParts,
  ymdInTimeZone,
} from "../booking/bookingTime";

export const OVERVIEW_RANGES = ["week", "month", "quarter", "year"] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

export const OVERVIEW_RANGE_LABELS: Record<OverviewRange, string> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

export type PlanCampaignInput = {
  status: string;
  queued: number;
  dailyInviteLimit: number;
  sendRules: unknown;
  timezone?: string | null;
  hasInviteStep: boolean;
  outreachPriority?: number;
  outreachWeight?: number;
};

export type AccountInvitePlanInput = {
  /** Shared send rules for the LinkedIn account. */
  sendRules: unknown;
  /** Max invites for a given local ymd / weekday (already includes mix). */
  dayQuota: (ymd: string, weekday: number) => number;
};

export type PlannedDayBucket = {
  date: string;
  planned: number;
};

export type CampaignWindow = {
  range: OverviewRange;
  offset: number;
  timezone: string;
  todayYmd: string;
  startYmd: string;
  endYmd: string;
};

const DEFAULT_SEND_WEEKDAYS = new Set([1, 2, 3, 4, 5]);

export function parseOverviewRange(raw: string | null): OverviewRange {
  if (raw === "week" || raw === "month" || raw === "year") return raw;
  return "quarter";
}

export function parseOverviewOffset(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < -24 || n > 24) return 0;
  return n;
}

export function overviewTimezone(
  campaigns: Array<{ timezone?: string | null; status?: string }>
): string {
  const running = campaigns.find(
    (c) => c.status === "running" && c.timezone?.trim()
  );
  const any = campaigns.find((c) => c.timezone?.trim());
  return (running?.timezone || any?.timezone || "Europe/London").trim();
}

function ymdParts(ymd: string): { year: number; month: number; day: number } {
  const [year, month, day] = ymd.split("-").map(Number);
  return { year: year || 1970, month: month || 1, day: day || 1 };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function padYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function weekdayOfYmd(ymd: string, timeZone: string): number {
  const { year, month, day } = ymdParts(ymd);
  const noon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return utcToZonedParts(noon, timeZone).weekday;
}

function sendWeekdays(rules: unknown): Set<number> {
  if (!Array.isArray(rules)) return new Set(DEFAULT_SEND_WEEKDAYS);
  const days = new Set<number>();
  for (const raw of rules) {
    if (!raw || typeof raw !== "object") continue;
    const weekday = Number((raw as { weekday?: unknown }).weekday);
    if (Number.isInteger(weekday) && weekday >= 0 && weekday <= 6) {
      days.add(weekday);
    }
  }
  return days.size > 0 ? days : new Set(DEFAULT_SEND_WEEKDAYS);
}

export function eachYmd(startYmd: string, endYmd: string): string[] {
  const days: string[] = [];
  let cur = startYmd;
  while (cur <= endYmd) {
    days.push(cur);
    const next = addDaysYmd(cur, 1);
    if (next <= cur) break;
    cur = next;
  }
  return days;
}

export function resolveCampaignWindow(input: {
  range: OverviewRange;
  offset?: number;
  now?: Date;
  timezone: string;
}): CampaignWindow {
  const timezone = input.timezone.trim() || "Europe/London";
  const offset = input.offset ?? 0;
  const now = input.now ?? new Date();
  const todayYmd = ymdInTimeZone(now, timezone);
  const today = ymdParts(todayYmd);

  if (input.range === "week") {
    const weekday = weekdayOfYmd(todayYmd, timezone);
    const mondayShift = weekday === 0 ? -6 : 1 - weekday;
    const startYmd = addDaysYmd(todayYmd, mondayShift + offset * 7);
    return {
      range: "week",
      offset,
      timezone,
      todayYmd,
      startYmd,
      endYmd: addDaysYmd(startYmd, 6),
    };
  }

  if (input.range === "month") {
    const monthIndex = today.year * 12 + (today.month - 1) + offset;
    const year = Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return {
      range: "month",
      offset,
      timezone,
      todayYmd,
      startYmd: padYmd(year, month, 1),
      endYmd: padYmd(year, month, lastDayOfMonth(year, month)),
    };
  }

  if (input.range === "year") {
    const year = today.year + offset;
    return {
      range: "year",
      offset,
      timezone,
      todayYmd,
      startYmd: padYmd(year, 1, 1),
      endYmd: padYmd(year, 12, 31),
    };
  }

  const baseQuarter = Math.floor((today.month - 1) / 3);
  const quarterIndex = today.year * 4 + baseQuarter + offset;
  const year = Math.floor(quarterIndex / 4);
  const quarter = ((quarterIndex % 4) + 4) % 4;
  const startMonth = quarter * 3 + 1;
  const endMonth = startMonth + 2;
  return {
    range: "quarter",
    offset,
    timezone,
    todayYmd,
    startYmd: padYmd(year, startMonth, 1),
    endYmd: padYmd(year, endMonth, lastDayOfMonth(year, endMonth)),
  };
}

function ordinalDay(day: number): string {
  const rem100 = day % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function monthShortUtc(ymd: string): string {
  return (
    [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][ymdParts(ymd).month - 1] ?? ""
  );
}

export function labelCampaignWindow(window: CampaignWindow): string {
  const start = ymdParts(window.startYmd);
  const end = ymdParts(window.endYmd);

  if (window.range === "week") {
    const startLabel = `${ordinalDay(start.day)} ${monthShortUtc(window.startYmd)}`;
    const endLabel = `${ordinalDay(end.day)} ${monthShortUtc(window.endYmd)}`;
    if (start.month === end.month && start.year === end.year) {
      return `${ordinalDay(start.day)}–${ordinalDay(end.day)} ${monthShortUtc(window.startYmd)}`;
    }
    return `${startLabel}–${endLabel}`;
  }

  if (window.range === "month") {
    return new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(start.year, start.month - 1, 1)));
  }

  if (window.range === "year") {
    return String(start.year);
  }

  const q = Math.floor((start.month - 1) / 3) + 1;
  return `Q${q} ${start.year}`;
}

function planableCampaigns(campaigns: PlanCampaignInput[]): PlanCampaignInput[] {
  return campaigns
    .filter(
      (c) => c.status === "running" && c.hasInviteStep && c.queued > 0
    )
    .sort((a, b) => {
      const pa = a.outreachPriority ?? 100;
      const pb = b.outreachPriority ?? 100;
      if (pa !== pb) return pa - pb;
      return (b.outreachWeight ?? 1) - (a.outreachWeight ?? 1);
    });
}

/**
 * Spread remaining invite queues across send days from today onward.
 * Past days in the window are 0. Days before the window still consume the
 * queue so a next-week view does not restart the hopper.
 *
 * When `accountPlan` is set, capacity is shared across campaigns (account-level).
 */
export function planInviteBuckets(input: {
  campaigns: PlanCampaignInput[];
  window: Pick<CampaignWindow, "startYmd" | "endYmd" | "todayYmd" | "timezone">;
  invitesSentToday: number;
  accountPlan?: AccountInvitePlanInput | null;
}): { buckets: PlannedDayBucket[]; plannedRemaining: number; fuelDays: number | null } {
  const { startYmd, endYmd, todayYmd, timezone } = input.window;
  const running = planableCampaigns(input.campaigns);
  const remaining = running.map((c) => Math.max(0, Math.floor(c.queued)));
  const weights = running.map((c) => Math.max(1, Math.floor(c.outreachWeight ?? 1)));
  const accountRules = input.accountPlan
    ? sendWeekdays(input.accountPlan.sendRules)
    : null;
  const weekdaySets = running.map((c) =>
    accountRules ?? sendWeekdays(c.sendRules)
  );
  const plannedByDay = new Map<string, number>();
  const sentToday = Math.max(0, Math.floor(input.invitesSentToday));

  let cursor = todayYmd;
  let fuelDays: number | null = remaining.some((n) => n > 0) ? 0 : null;
  let emptyOn = remaining.every((n) => n <= 0);

  const lastPlanDay = endYmd > todayYmd ? endYmd : todayYmd;
  const safetyEnd = addDaysYmd(todayYmd, 90);

  while (cursor <= safetyEnd) {
    const weekday = weekdayOfYmd(cursor, timezone);
    let dayUsed = cursor === todayYmd ? sentToday : 0;
    let sentThisDay = 0;

    const dayCap = input.accountPlan
      ? Math.max(0, Math.floor(input.accountPlan.dayQuota(cursor, weekday)))
      : null;

    if (dayCap != null) {
      let capacity = Math.max(0, dayCap - dayUsed);
      if (capacity > 0) {
        const active = running
          .map((_, i) => i)
          .filter(
            (i) => remaining[i]! > 0 && weekdaySets[i]!.has(weekday)
          );
        const weightSum = active.reduce((s, i) => s + weights[i]!, 0) || 1;
        for (const i of active) {
          if (capacity <= 0) break;
          const share = Math.max(
            1,
            Math.round((capacity * weights[i]!) / weightSum)
          );
          const send = Math.min(remaining[i]!, capacity, share);
          if (send <= 0) continue;
          remaining[i]! -= send;
          capacity -= send;
          dayUsed += send;
          sentThisDay += send;
        }
        // Leftover capacity cascades by priority order.
        for (const i of active) {
          if (capacity <= 0) break;
          if (remaining[i]! <= 0) continue;
          const send = Math.min(remaining[i]!, capacity);
          remaining[i]! -= send;
          capacity -= send;
          dayUsed += send;
          sentThisDay += send;
        }
      }
    } else {
      for (let i = 0; i < running.length; i += 1) {
        if (remaining[i] <= 0) continue;
        if (!weekdaySets[i]!.has(weekday)) continue;
        const limit = Math.max(0, Math.floor(running[i]!.dailyInviteLimit));
        const capacity = Math.max(0, limit - dayUsed);
        const send = Math.min(remaining[i]!, capacity);
        if (send <= 0) continue;
        remaining[i]! -= send;
        dayUsed += send;
        sentThisDay += send;
      }
    }

    if (cursor >= startYmd && cursor <= endYmd) {
      plannedByDay.set(cursor, (plannedByDay.get(cursor) ?? 0) + sentThisDay);
    }

    if (!emptyOn) {
      fuelDays = (fuelDays ?? 0) + 1;
      if (remaining.every((n) => n <= 0)) emptyOn = true;
    }

    if (cursor >= lastPlanDay && remaining.every((n) => n <= 0)) break;
    const next = addDaysYmd(cursor, 1);
    if (next <= cursor) break;
    cursor = next;
  }

  const buckets = eachYmd(startYmd, endYmd).map((date) => ({
    date,
    planned: date < todayYmd ? 0 : plannedByDay.get(date) ?? 0,
  }));
  const plannedRemaining = buckets.reduce((sum, b) => sum + b.planned, 0);

  return {
    buckets,
    plannedRemaining,
    fuelDays: remaining.some((n) => n > 0) ? 90 : fuelDays,
  };
}

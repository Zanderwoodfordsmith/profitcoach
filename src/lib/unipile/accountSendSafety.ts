/**
 * Account-level LinkedIn send safety planner (pure functions).
 * Weekly budget → weekday mix → daily jitter → sprinkle across the window.
 */

import {
  addDaysYmd,
  parseTimeToMinutes,
  utcToZonedParts,
  ymdInTimeZone,
  zonedLocalToUtc,
} from "@/lib/booking/bookingTime";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";
import {
  DEFAULT_CAMPAIGN_SEND_RULES,
  parseCampaignSendRules,
} from "@/lib/unipile/campaignSendWindow";

export const WEEKLY_INVITE_MIN = 20;
export const WEEKLY_INVITE_MAX = 200;
export const WEEKLY_INVITE_DEFAULT = 100;
export const SSI_HIGH_THRESHOLD = 70;
export const SSI_LOW_WARMUP_THRESHOLD = 40;
export const ACCEPT_RATE_WARN = 0.3;
export const ACCEPT_RATE_PAUSE_HINT = 0.15;
export const ACCEPT_RATE_MIN_SAMPLE = 20;

/** Mon-heavy / Tue peak weekday shares (percent before renormalise). */
export const WEEKDAY_WEIGHTS: Record<number, number> = {
  0: 10, // Sun
  1: 24, // Mon
  2: 27, // Tue
  3: 20, // Wed
  4: 16, // Thu
  5: 13, // Fri
  6: 10, // Sat
};

export type DailySendPlan = {
  ymd: string;
  weekCap: number;
  weekRemaining: number;
  inviteQuota: number;
  messageQuota: number;
  reactQuota: number;
  invitesAssigned: number;
  messagesAssigned: number;
  reactsAssigned: number;
  weekJitterPct: number;
  dayJitterPct: number;
};

export function clampWeeklyInviteTarget(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return WEEKLY_INVITE_DEFAULT;
  return Math.min(WEEKLY_INVITE_MAX, Math.max(WEEKLY_INVITE_MIN, Math.round(n)));
}

export function recommendedWeeklyInvites(ssiScore: number | null | undefined): number {
  if (ssiScore == null || !Number.isFinite(ssiScore)) return WEEKLY_INVITE_DEFAULT;
  return ssiScore >= SSI_HIGH_THRESHOLD ? WEEKLY_INVITE_MAX : WEEKLY_INVITE_DEFAULT;
}

export function warmupWeekIndex(
  warmupStartedAt: string | Date | null | undefined,
  now = new Date()
): number {
  if (!warmupStartedAt) return 1;
  const start = warmupStartedAt instanceof Date
    ? warmupStartedAt
    : new Date(warmupStartedAt);
  if (!Number.isFinite(start.getTime())) return 1;
  const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
  return Math.floor(days / 7) + 1;
}

/** Share of weekly target during warm-up (1-indexed week). */
export function warmupMultiplier(
  weekIndex: number,
  ssiScore: number | null | undefined
): number {
  if (weekIndex <= 1) {
    if (ssiScore == null || !Number.isFinite(ssiScore) || ssiScore < SSI_LOW_WARMUP_THRESHOLD) {
      return 0.2;
    }
    return 0.3;
  }
  if (weekIndex === 2) return 0.6;
  if (weekIndex === 3) return 0.9;
  return 1;
}

export function effectiveWeeklyCap(input: {
  weeklyTarget: number;
  ssiScore?: number | null;
  warmupStartedAt?: string | Date | null;
  warmupEnabled?: boolean;
  now?: Date;
}): number {
  const target = clampWeeklyInviteTarget(input.weeklyTarget);
  if (input.warmupEnabled === false) {
    return target;
  }
  const week = warmupWeekIndex(input.warmupStartedAt ?? null, input.now);
  const mult = warmupMultiplier(week, input.ssiScore);
  return Math.max(WEEKLY_INVITE_MIN, Math.round(target * mult));
}

/** Stable 0..1 from a string seed (FNV-1a style). */
export function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Week jitter 90–100% of effective cap. */
export function weekJitterPct(accountId: string, weekKey: string): number {
  return 0.9 + hashUnit(`week:${accountId}:${weekKey}`) * 0.1;
}

/** Day jitter ±15% around the mix share. */
export function dayJitterFactor(accountId: string, ymd: string): number {
  return 0.85 + hashUnit(`day:${accountId}:${ymd}`) * 0.3;
}

export function rollingWeekKey(ymd: string): string {
  // Anchor on the ymd itself — remaining budget is rolling 7d, jitter key rotates daily
  // but we want week-stable noise: use the Monday of that local week-ish by peeling days.
  // Simpler: use first day of the rolling window start (ymd - 6).
  return addDaysYmd(ymd, -6);
}

export function weekdayWeightsForRules(rules: AvailabilityRuleRow[]): Map<number, number> {
  const days = rules.map((r) => r.weekday);
  const unique = [...new Set(days)].sort((a, b) => a - b);
  const map = new Map<number, number>();
  if (unique.length === 0) {
    for (const [d, w] of Object.entries(WEEKDAY_WEIGHTS)) {
      map.set(Number(d), w);
    }
    return map;
  }
  let total = 0;
  for (const d of unique) {
    const w = WEEKDAY_WEIGHTS[d] ?? 15;
    map.set(d, w);
    total += w;
  }
  if (total <= 0) {
    const even = 1 / unique.length;
    for (const d of unique) map.set(d, even);
    return map;
  }
  for (const d of unique) {
    map.set(d, (map.get(d) ?? 0) / total);
  }
  return map;
}

export function todayInviteQuota(input: {
  accountId: string;
  ymd: string;
  weekday: number;
  weekRemaining: number;
  weekCap: number;
  sendRules: AvailabilityRuleRow[];
}): { quota: number; dayJitterPct: number; mixShare: number } {
  const weights = weekdayWeightsForRules(input.sendRules);
  const mixShare = weights.get(input.weekday) ?? 0;
  if (mixShare <= 0 || input.weekRemaining <= 0) {
    return { quota: 0, dayJitterPct: 1, mixShare: 0 };
  }
  const remainingSendDays = estimateRemainingSendDays(
    input.ymd,
    input.sendRules,
    7
  );
  // Prefer mix share of full weekCap, but never exceed remaining / remaining days * cushion.
  const fromMix = input.weekCap * mixShare;
  const jitter = dayJitterFactor(input.accountId, input.ymd);
  let quota = Math.round(fromMix * jitter);
  const maxFromRemaining =
    remainingSendDays <= 1
      ? input.weekRemaining
      : Math.ceil(input.weekRemaining / remainingSendDays) + 2;
  quota = Math.min(quota, input.weekRemaining, Math.max(1, maxFromRemaining));
  quota = Math.max(0, quota);
  return { quota, dayJitterPct: jitter, mixShare };
}

function estimateRemainingSendDays(
  fromYmd: string,
  rules: AvailabilityRuleRow[],
  horizon: number
): number {
  const days = new Set(rules.map((r) => r.weekday));
  if (days.size === 0) return 1;
  let count = 0;
  for (let i = 0; i < horizon; i += 1) {
    const ymd = addDaysYmd(fromYmd, i);
    const [y, m, d] = ymd.split("-").map(Number);
    const noon = Date.UTC(y, m - 1, d, 12, 0, 0);
    const weekday = new Date(noon).getUTCDay();
    // Use local weekday via parts would be better; for estimate UTC noon is fine for weight math.
    // Caller passes real weekday for today; this is only a remaining-days estimate.
    void weekday;
    // Recompute with a timezone-agnostic weekday from ymd using same approach as plan buckets.
    const wd = weekdayOfUtcNoon(ymd);
    if (days.has(wd)) count += 1;
  }
  return Math.max(1, count);
}

function weekdayOfUtcNoon(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

export function randomiseDailyQuota(
  target: number,
  accountId: string,
  ymd: string,
  kind: "message" | "react"
): number {
  const base = Math.max(1, Math.round(target));
  const factor = 0.85 + hashUnit(`${kind}:${accountId}:${ymd}`) * 0.3;
  return Math.max(1, Math.round(base * factor));
}

/**
 * Sprinkle N send times across [windowStart, windowEnd] with min gap.
 * Times are Date objects in absolute UTC.
 */
export function sprinkleSendTimes(input: {
  count: number;
  windowStart: Date;
  windowEnd: Date;
  minGapSeconds: number;
  seed: string;
  now?: Date;
}): Date[] {
  const n = Math.max(0, Math.floor(input.count));
  if (n === 0) return [];
  const now = input.now ?? new Date();
  const startMs = Math.max(input.windowStart.getTime(), now.getTime());
  const endMs = input.windowEnd.getTime();
  if (endMs <= startMs) {
    return Array.from({ length: n }, (_, i) => new Date(startMs + i * 1000));
  }
  const minGap = Math.max(60, input.minGapSeconds) * 1000;
  const span = endMs - startMs;
  const times: Date[] = [];
  let cursor = startMs;
  for (let i = 0; i < n; i += 1) {
    const left = n - i;
    const remainingSpan = Math.max(0, endMs - cursor);
    const idealGap = left > 1 ? remainingSpan / left : 0;
    const jitter = 0.5 + hashUnit(`${input.seed}:${i}`) * 1.0;
    const gap = Math.min(
      remainingSpan / Math.max(1, left),
      Math.max(minGap, idealGap * jitter)
    );
    const t = Math.min(endMs - (left - 1) * Math.min(minGap, remainingSpan / left), cursor + (i === 0 ? hashUnit(`${input.seed}:0`) * Math.min(minGap, span / n) : gap));
    const at = new Date(Math.max(cursor, Math.min(endMs, t)));
    times.push(at);
    cursor = at.getTime() + minGap;
  }
  return times;
}

export function windowBoundsForDay(input: {
  ymd: string;
  timeZone: string;
  rules: AvailabilityRuleRow[];
}): { start: Date; end: Date } | null {
  const [year, month, day] = input.ymd.split("-").map(Number);
  const noon = zonedLocalToUtc({
    year,
    month,
    day,
    hour: 12,
    minute: 0,
    timeZone: input.timeZone,
  });
  const parts = utcToZonedParts(noon, input.timeZone);
  const rule = input.rules.find((r) => r.weekday === parts.weekday);
  if (!rule) return null;
  const startMin = parseTimeToMinutes(rule.start_time);
  const endMin = parseTimeToMinutes(rule.end_time);
  const start = zonedLocalToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: Math.floor(startMin / 60),
    minute: startMin % 60,
    timeZone: input.timeZone,
  });
  const end = zonedLocalToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: Math.floor(endMin / 60),
    minute: endMin % 60,
    timeZone: input.timeZone,
  });
  return { start, end };
}

export function parseDailySendPlan(raw: unknown): DailySendPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const ymd = String(o.ymd || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const num = (v: unknown, fallback = 0) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
  };
  return {
    ymd,
    weekCap: num(o.weekCap),
    weekRemaining: num(o.weekRemaining),
    inviteQuota: num(o.inviteQuota),
    messageQuota: num(o.messageQuota),
    reactQuota: num(o.reactQuota),
    invitesAssigned: num(o.invitesAssigned),
    messagesAssigned: num(o.messagesAssigned),
    reactsAssigned: num(o.reactsAssigned),
    weekJitterPct: typeof o.weekJitterPct === "number" ? o.weekJitterPct : 1,
    dayJitterPct: typeof o.dayJitterPct === "number" ? o.dayJitterPct : 1,
  };
}

export function buildDailySendPlan(input: {
  accountId: string;
  ymd: string;
  weekday: number;
  weeklyTarget: number;
  ssiScore?: number | null;
  warmupStartedAt?: string | Date | null;
  warmupEnabled?: boolean;
  invitesSentRolling7d: number;
  dailyMessageTarget: number;
  dailyReactTarget: number;
  sendRules: unknown;
  now?: Date;
}): DailySendPlan {
  const rules = parseCampaignSendRules(input.sendRules);
  const effective = effectiveWeeklyCap({
    weeklyTarget: input.weeklyTarget,
    ssiScore: input.ssiScore,
    warmupStartedAt: input.warmupStartedAt,
    warmupEnabled: input.warmupEnabled,
    now: input.now,
  });
  const weekKey = rollingWeekKey(input.ymd);
  const wJitter = weekJitterPct(input.accountId, weekKey);
  const weekCap = Math.max(
    WEEKLY_INVITE_MIN,
    Math.round(effective * wJitter)
  );
  const weekRemaining = Math.max(0, weekCap - Math.max(0, input.invitesSentRolling7d));
  const { quota, dayJitterPct } = todayInviteQuota({
    accountId: input.accountId,
    ymd: input.ymd,
    weekday: input.weekday,
    weekRemaining,
    weekCap,
    sendRules: rules.length ? rules : DEFAULT_CAMPAIGN_SEND_RULES,
  });
  return {
    ymd: input.ymd,
    weekCap,
    weekRemaining,
    inviteQuota: quota,
    messageQuota: randomiseDailyQuota(
      input.dailyMessageTarget,
      input.accountId,
      input.ymd,
      "message"
    ),
    reactQuota: randomiseDailyQuota(
      input.dailyReactTarget,
      input.accountId,
      input.ymd,
      "react"
    ),
    invitesAssigned: 0,
    messagesAssigned: 0,
    reactsAssigned: 0,
    weekJitterPct: wJitter,
    dayJitterPct,
  };
}

export function acceptRateStatus(
  accepted: number,
  sent: number
): {
  rate: number | null;
  sample: number;
  warn: boolean;
  pauseHint: boolean;
} {
  const sample = Math.max(0, Math.floor(sent));
  if (sample < ACCEPT_RATE_MIN_SAMPLE) {
    return { rate: null, sample, warn: false, pauseHint: false };
  }
  const rate = Math.max(0, accepted) / sample;
  return {
    rate,
    sample,
    warn: rate < ACCEPT_RATE_WARN,
    pauseHint: rate < ACCEPT_RATE_PAUSE_HINT,
  };
}

export function todayYmdAndWeekday(
  now: Date,
  timeZone: string
): { ymd: string; weekday: number } {
  const ymd = ymdInTimeZone(now, timeZone);
  const parts = utcToZonedParts(now, timeZone);
  return { ymd, weekday: parts.weekday };
}

export function actionDelaySeconds(
  minSeconds: number,
  maxSeconds: number,
  seed: string
): number {
  const min = Math.max(60, Math.floor(minSeconds));
  const max = Math.max(min, Math.floor(maxSeconds));
  const span = max - min;
  return min + Math.floor(hashUnit(seed) * (span + 1));
}

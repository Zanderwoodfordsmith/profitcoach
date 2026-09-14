/**
 * Pending LinkedIn invite hygiene.
 *
 * AuthZ lives at the API/cron boundary (coach session or cron secret).
 * This module only decides *which* already-listed invites to withdraw.
 * Client cannot set last-run fields; daily caps bound blast radius.
 *
 * Product default: keep pending under PENDING_KEEP_UNDER, oldest first,
 * up to AUTO_DAILY_MAX/day on weekdays only.
 */

import { PENDING_KEEP_UNDER } from "@/lib/unipile/pendingInviteDial";

export const INVITE_WITHDRAW_MODES = ["off", "daily", "cap", "age"] as const;
export type InviteWithdrawMode = (typeof INVITE_WITHDRAW_MODES)[number];

export const MANUAL_WITHDRAW_MAX = 50;
export const AUTO_DAILY_MAX = 25;
/** LinkedIn’s practical pending wall is ~800; allow a little headroom for the dial. */
export const PENDING_LIST_MAX = 1000;
/** Default auto rule: keep pending at or below this. */
export const DEFAULT_KEEP_UNDER = PENDING_KEEP_UNDER;

export const WITHDRAW_VALUE_MAX: Record<Exclude<InviteWithdrawMode, "off">, number> =
  {
    daily: MANUAL_WITHDRAW_MAX,
    cap: 800,
    age: 90,
  };

export const WITHDRAW_VALUE_DEFAULT: Record<
  Exclude<InviteWithdrawMode, "off">,
  number
> = {
  daily: 20,
  cap: DEFAULT_KEEP_UNDER,
  age: 14,
};

export type InviteWithdrawPolicy = {
  mode: InviteWithdrawMode;
  value: number;
  ranOn: string | null;
  ranCount: number;
};

export type DatedInvite = {
  id: string;
  sentAt: number;
};

export function isInviteWithdrawMode(value: unknown): value is InviteWithdrawMode {
  return (
    typeof value === "string" &&
    (INVITE_WITHDRAW_MODES as readonly string[]).includes(value)
  );
}

export function utcDateYmd(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function asYmd(value: string | null | undefined): string | null {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function inviteSentAt(iso: string | null | undefined): number {
  const t = new Date(iso || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function inviteAgeDays(
  iso: string | null | undefined,
  now = Date.now()
): number | null {
  const sent = inviteSentAt(iso);
  if (!sent) return null;
  return Math.max(0, Math.floor((now - sent) / 86_400_000));
}

export function clampWithdrawValue(
  mode: InviteWithdrawMode,
  value: unknown
): number {
  if (mode === "off") return WITHDRAW_VALUE_DEFAULT.cap;
  const max = WITHDRAW_VALUE_MAX[mode];
  const fallback = WITHDRAW_VALUE_DEFAULT[mode];
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.round(n)));
}

export function parseInviteWithdrawPolicy(row: {
  invite_withdraw_mode?: string | null;
  invite_withdraw_value?: number | null;
  invite_withdraw_ran_on?: string | null;
  invite_withdraw_ran_count?: number | null;
} | null): InviteWithdrawPolicy {
  const rawMode = isInviteWithdrawMode(row?.invite_withdraw_mode)
    ? row.invite_withdraw_mode
    : "off";
  // Product is one rule: keep-under. Legacy daily/age → cap.
  const mode: InviteWithdrawMode =
    rawMode === "off" ? "off" : "cap";
  const ranCount = Number(row?.invite_withdraw_ran_count ?? 0);
  const stored = row?.invite_withdraw_value;
  const value =
    mode === "off"
      ? DEFAULT_KEEP_UNDER
      : clampWithdrawValue(
          "cap",
          rawMode === "cap" ? (stored ?? DEFAULT_KEEP_UNDER) : DEFAULT_KEEP_UNDER
        );
  return {
    mode,
    value,
    ranOn: asYmd(row?.invite_withdraw_ran_on),
    ranCount: Number.isFinite(ranCount) ? Math.max(0, Math.floor(ranCount)) : 0,
  };
}

/** Max auto-withdraws for a calendar day (weekends: none). */
export function autoDailyCapForDay(isWeekend: boolean): number {
  return isWeekend ? 0 : AUTO_DAILY_MAX;
}

export function dailyAutoQuota(
  mode: InviteWithdrawMode,
  value: number,
  isWeekend = false
): number {
  if (mode === "off") return 0;
  const dayCap = autoDailyCapForDay(isWeekend);
  if (mode === "daily") {
    return Math.min(dayCap, clampWithdrawValue("daily", value));
  }
  return dayCap;
}

export function remainingAutoQuota(
  policy: InviteWithdrawPolicy,
  todayYmd: string,
  isWeekend = false
): number {
  const quota = dailyAutoQuota(policy.mode, policy.value, isWeekend);
  if (quota <= 0) return 0;
  if (policy.ranOn === todayYmd) {
    return Math.max(0, quota - policy.ranCount);
  }
  return quota;
}

/** Soft cap per cron tick so we sprinkle across the day (~4 ticks × 6). */
export const AUTO_WITHDRAW_PER_TICK = 6;

export function selectInvitesToWithdraw(
  invites: DatedInvite[],
  policy: Pick<InviteWithdrawPolicy, "mode" | "value">,
  quota: number,
  now = Date.now()
): string[] {
  const limit = Math.min(
    MANUAL_WITHDRAW_MAX,
    AUTO_WITHDRAW_PER_TICK,
    Math.max(0, Math.floor(quota))
  );
  if (limit <= 0 || policy.mode === "off" || invites.length === 0) return [];

  const oldestFirst = [...invites].sort((a, b) => a.sentAt - b.sentAt);

  if (policy.mode === "daily") {
    return oldestFirst.slice(0, Math.min(limit, policy.value)).map((i) => i.id);
  }

  if (policy.mode === "cap") {
    const over = Math.max(0, oldestFirst.length - policy.value);
    return oldestFirst.slice(0, Math.min(limit, over)).map((i) => i.id);
  }

  const cutoff = now - policy.value * 86_400_000;
  return oldestFirst
    .filter((invite) => invite.sentAt > 0 && invite.sentAt <= cutoff)
    .slice(0, limit)
    .map((i) => i.id);
}

export function withdrawPolicySummary(
  policy: InviteWithdrawPolicy,
  pending: number
): string {
  if (policy.mode === "off") {
    return "Auto-clean is off. We’ll only clear invites when you ask.";
  }
  if (policy.mode === "daily") {
    return `Each day we’ll withdraw the ${policy.value} oldest pending request${
      policy.value === 1 ? "" : "s"
    }.`;
  }
  if (policy.mode === "cap") {
    const over = Math.max(0, pending - policy.value);
    if (over === 0) {
      return `Keeping pending at ${policy.value} or fewer. You’re under that now.`;
    }
    return `You’re ${over} over ${policy.value}. We’ll withdraw the oldest, up to ${AUTO_DAILY_MAX}/day on weekdays.`;
  }
  return `We’ll withdraw requests waiting ${policy.value} day${
    policy.value === 1 ? "" : "s"
  } or more, oldest first, up to ${AUTO_DAILY_MAX} a day.`;
}

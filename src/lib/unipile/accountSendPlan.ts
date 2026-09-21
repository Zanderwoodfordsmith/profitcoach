/**
 * DB-backed account send plan: load settings, ensure today's plan, sprinkle jobs.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ymdInTimeZone } from "@/lib/booking/bookingTime";
import {
  actionDelaySeconds,
  buildDailySendPlan,
  clampWeeklyInviteTarget,
  parseDailySendPlan,
  recommendedWeeklyInvites,
  sprinkleSendTimes,
  todayYmdAndWeekday,
  windowBoundsForDay,
  type DailySendPlan,
  acceptRateStatus,
  effectiveWeeklyCap,
  warmupWeekIndex,
} from "@/lib/unipile/accountSendSafety";
import {
  DEFAULT_CAMPAIGN_SEND_RULES,
  parseCampaignSendRules,
} from "@/lib/unipile/campaignSendWindow";

export type AccountSendSettings = {
  id: string;
  coach_id: string;
  unipile_account_id: string;
  status: string;
  weekly_invite_target: number;
  daily_message_target: number;
  daily_react_target: number;
  min_action_delay_seconds: number;
  max_action_delay_seconds: number;
  timezone: string;
  send_rules: unknown;
  warmup_started_at: string | null;
  warmup_enabled: boolean;
  invite_paused_until: string | null;
  rate_limited_until: string | null;
  daily_send_plan: unknown;
  ssi_score: number | null;
};

const ACCOUNT_SELECT =
  "id, coach_id, unipile_account_id, status, weekly_invite_target, daily_message_target, daily_react_target, min_action_delay_seconds, max_action_delay_seconds, timezone, send_rules, warmup_started_at, warmup_enabled, invite_paused_until, rate_limited_until, daily_send_plan, ssi_score";

export async function loadAccountSendSettings(
  accountId: string
): Promise<AccountSendSettings | null> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select(ACCOUNT_SELECT)
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as AccountSendSettings;
}

export async function loadCoachLinkedInSendSettings(
  coachId: string
): Promise<AccountSendSettings | null> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select(ACCOUNT_SELECT)
    .eq("coach_id", coachId)
    .eq("status", "OK")
    .ilike("provider", "linkedin")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as AccountSendSettings;
}

export async function countInvitesInRollingDays(
  coachId: string,
  days: number
): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: jobs } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("id, step_id")
    .eq("coach_id", coachId)
    .eq("status", "succeeded")
    .gte("updated_at", since);
  if (!jobs?.length) return 0;
  const stepIds = [...new Set(jobs.map((j) => j.step_id as string))];
  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("id, step_type")
    .in("id", stepIds);
  const inviteIds = new Set(
    (steps ?? [])
      .filter((s) => s.step_type === "invite" || s.step_type === "instagram_follow")
      .map((s) => s.id as string)
  );
  return jobs.filter((j) => inviteIds.has(j.step_id as string)).length;
}

export async function countSucceededActionToday(
  coachId: string,
  stepTypes: string[],
  timeZone: string,
  campaignId?: string | null
): Promise<number> {
  const { startOfZonedDay } = await import("@/lib/unipile/campaignSendWindow");
  const start = startOfZonedDay(new Date(), timeZone || "Europe/London");
  let query = supabaseAdmin
    .from("linkedin_send_jobs")
    .select("id, step_id")
    .eq("coach_id", coachId)
    .eq("status", "succeeded")
    .gte("updated_at", start.toISOString());
  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }
  const { data: jobs } = await query;
  if (!jobs?.length) return 0;
  const stepIds = [...new Set(jobs.map((j) => j.step_id as string))];
  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("id, step_type")
    .in("id", stepIds);
  const match = new Set(
    (steps ?? [])
      .filter((s) => stepTypes.includes(String(s.step_type)))
      .map((s) => s.id as string)
  );
  return jobs.filter((j) => match.has(j.step_id as string)).length;
}

/** Acceptance over last 50 invite outcomes (or fewer). */
export async function loadInviteAcceptStats(coachId: string): Promise<{
  sent: number;
  accepted: number;
}> {
  const { data: leads } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("status, updated_at")
    .eq("coach_id", coachId)
    .in("status", [
      "invited",
      "connected",
      "in_sequence",
      "replied",
      "interested",
      "completed",
      "paused",
      "failed",
      "skipped",
    ])
    .order("updated_at", { ascending: false })
    .limit(80);

  // Count leads that have moved past invite or are still waiting.
  let sent = 0;
  let accepted = 0;
  for (const lead of leads ?? []) {
    const status = String(lead.status || "");
    if (status === "invited") {
      sent += 1;
      continue;
    }
    if (
      [
        "connected",
        "in_sequence",
        "replied",
        "interested",
        "completed",
        "paused",
      ].includes(status)
    ) {
      sent += 1;
      accepted += 1;
    }
    if (sent >= 50) break;
  }
  return { sent, accepted };
}

export async function ensureWarmupStarted(
  account: AccountSendSettings
): Promise<AccountSendSettings> {
  if (account.warmup_started_at) return account;
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .update({ warmup_started_at: now })
    .eq("id", account.id)
    .is("warmup_started_at", null)
    .select(ACCOUNT_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as AccountSendSettings;
  return { ...account, warmup_started_at: now };
}

export async function ensureDailySendPlan(
  account: AccountSendSettings,
  now = new Date()
): Promise<{ account: AccountSendSettings; plan: DailySendPlan }> {
  const withWarmup = await ensureWarmupStarted(account);
  const timeZone = withWarmup.timezone?.trim() || "Europe/London";
  const { ymd, weekday } = todayYmdAndWeekday(now, timeZone);
  const existing = parseDailySendPlan(withWarmup.daily_send_plan);
  if (existing && existing.ymd === ymd) {
    return { account: withWarmup, plan: existing };
  }

  const invitesSentRolling7d = await countInvitesInRollingDays(
    withWarmup.coach_id,
    7
  );
  const plan = buildDailySendPlan({
    accountId: withWarmup.id,
    ymd,
    weekday,
    weeklyTarget: withWarmup.weekly_invite_target,
    ssiScore: withWarmup.ssi_score,
    warmupStartedAt: withWarmup.warmup_started_at,
    warmupEnabled: withWarmup.warmup_enabled !== false,
    invitesSentRolling7d,
    dailyMessageTarget: withWarmup.daily_message_target,
    dailyReactTarget: withWarmup.daily_react_target,
    sendRules: withWarmup.send_rules,
    now,
  });

  // Align assigned counters with already-sent today so restarts don't oversend.
  const [invitesToday, messagesToday, reactsToday] = await Promise.all([
    countSucceededActionToday(
      withWarmup.coach_id,
      ["invite", "instagram_follow"],
      timeZone
    ),
    countSucceededActionToday(
      withWarmup.coach_id,
      ["message", "instagram", "messenger"],
      timeZone
    ),
    countSucceededActionToday(
      withWarmup.coach_id,
      ["react", "instagram_react"],
      timeZone
    ),
  ]);
  plan.invitesAssigned = invitesToday;
  plan.messagesAssigned = messagesToday;
  plan.reactsAssigned = reactsToday;

  const { data, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .update({ daily_send_plan: plan })
    .eq("id", withWarmup.id)
    .select(ACCOUNT_SELECT)
    .single();
  if (error) throw new Error(error.message);

  await sprinklePendingInviteJobs({
    account: data as AccountSendSettings,
    plan,
    now,
  });

  return { account: data as AccountSendSettings, plan };
}

async function sprinklePendingInviteJobs(input: {
  account: AccountSendSettings;
  plan: DailySendPlan;
  now: Date;
}) {
  const remaining = Math.max(
    0,
    input.plan.inviteQuota - input.plan.invitesAssigned
  );
  if (remaining <= 0) return;

  const timeZone = input.account.timezone?.trim() || "Europe/London";
  const rules = parseCampaignSendRules(input.account.send_rules);
  const bounds = windowBoundsForDay({
    ymd: input.plan.ymd,
    timeZone,
    rules: rules.length ? rules : DEFAULT_CAMPAIGN_SEND_RULES,
  });
  if (!bounds) return;

  const { data: campaignIds } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .eq("outreach_account_id", input.account.id)
    .eq("status", "running");
  const ids = (campaignIds ?? []).map((c) => c.id as string);
  if (!ids.length) return;

  const { data: inviteSteps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("id")
    .in("campaign_id", ids)
    .eq("step_type", "invite");
  const stepIds = (inviteSteps ?? []).map((s) => s.id as string);
  if (!stepIds.length) return;

  const { data: jobs } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("id, scheduled_for")
    .eq("coach_id", input.account.coach_id)
    .eq("status", "pending")
    .in("campaign_id", ids)
    .in("step_id", stepIds)
    .order("scheduled_for", { ascending: true })
    .limit(remaining);

  if (!jobs?.length) return;

  const minGap = Math.max(
    60,
    Math.floor(
      (input.account.min_action_delay_seconds +
        input.account.max_action_delay_seconds) /
        2
    )
  );
  const times = sprinkleSendTimes({
    count: jobs.length,
    windowStart: bounds.start,
    windowEnd: bounds.end,
    minGapSeconds: minGap,
    seed: `${input.account.id}:${input.plan.ymd}`,
    now: input.now,
  });

  for (let i = 0; i < jobs.length; i += 1) {
    const at = times[i];
    if (!at) break;
    await supabaseAdmin
      .from("linkedin_send_jobs")
      .update({ scheduled_for: at.toISOString() })
      .eq("id", jobs[i]!.id)
      .eq("status", "pending");
  }
}

export async function bumpDailyPlanAssigned(
  accountId: string,
  kind: "invite" | "message" | "react"
) {
  const account = await loadAccountSendSettings(accountId);
  if (!account) return;
  const plan = parseDailySendPlan(account.daily_send_plan);
  if (!plan) return;
  if (kind === "invite") plan.invitesAssigned += 1;
  if (kind === "message") plan.messagesAssigned += 1;
  if (kind === "react") plan.reactsAssigned += 1;
  await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .update({ daily_send_plan: plan })
    .eq("id", accountId);
}

export async function pauseInvitesUntil(
  accountId: string,
  until: Date,
  _reason: string
) {
  await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .update({ invite_paused_until: until.toISOString() })
    .eq("id", accountId);
}

export async function setRateLimitedUntil(accountId: string, until: Date) {
  await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .update({ rate_limited_until: until.toISOString() })
    .eq("id", accountId);
}

export function nextActionDelayForAccount(
  account: AccountSendSettings,
  seed: string
): number {
  return actionDelaySeconds(
    account.min_action_delay_seconds || 180,
    account.max_action_delay_seconds || 480,
    seed
  );
}

export function isInvitePaused(account: AccountSendSettings, now = new Date()) {
  if (!account.invite_paused_until) return false;
  return new Date(account.invite_paused_until).getTime() > now.getTime();
}

export function isRateLimited(account: AccountSendSettings, now = new Date()) {
  if (!account.rate_limited_until) return false;
  return new Date(account.rate_limited_until).getTime() > now.getTime();
}

export async function updateAccountSendSettings(
  coachId: string,
  accountId: string,
  patch: Record<string, unknown>
) {
  const allowed = [
    "weekly_invite_target",
    "daily_message_target",
    "daily_react_target",
    "min_action_delay_seconds",
    "max_action_delay_seconds",
    "timezone",
    "send_rules",
    "warmup_enabled",
  ] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in patch) update[key] = patch[key];
  }
  if ("warmup_enabled" in update) {
    update.warmup_enabled = Boolean(update.warmup_enabled);
  }
  if ("weekly_invite_target" in update) {
    update.weekly_invite_target = clampWeeklyInviteTarget(
      update.weekly_invite_target
    );
  }
  if ("daily_message_target" in update) {
    const n = Number(update.daily_message_target);
    update.daily_message_target = Math.min(
      100,
      Math.max(1, Number.isFinite(n) ? Math.round(n) : 20)
    );
  }
  if ("daily_react_target" in update) {
    const n = Number(update.daily_react_target);
    update.daily_react_target = Math.min(
      100,
      Math.max(1, Number.isFinite(n) ? Math.round(n) : 12)
    );
  }
  if ("min_action_delay_seconds" in update) {
    const n = Number(update.min_action_delay_seconds);
    update.min_action_delay_seconds = Math.min(
      1800,
      Math.max(60, Number.isFinite(n) ? Math.round(n) : 180)
    );
  }
  if ("max_action_delay_seconds" in update) {
    const n = Number(update.max_action_delay_seconds);
    update.max_action_delay_seconds = Math.min(
      3600,
      Math.max(60, Number.isFinite(n) ? Math.round(n) : 480)
    );
  }
  if (
    typeof update.min_action_delay_seconds === "number" &&
    typeof update.max_action_delay_seconds === "number" &&
    update.max_action_delay_seconds < update.min_action_delay_seconds
  ) {
    update.max_action_delay_seconds = update.min_action_delay_seconds;
  }
  if ("send_rules" in update) {
    update.send_rules = parseCampaignSendRules(update.send_rules);
  }
  if (typeof update.timezone === "string") {
    update.timezone = update.timezone.trim() || "Europe/London";
  }
  // Force plan rebuild next tick.
  update.daily_send_plan = {};

  const { data, error } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .update(update)
    .eq("id", accountId)
    .eq("coach_id", coachId)
    .select(ACCOUNT_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Account not found.");
  return data as AccountSendSettings;
}

export async function accountSendSafetySnapshot(coachId: string) {
  const account = await loadCoachLinkedInSendSettings(coachId);
  if (!account) return null;

  const now = new Date();
  const timeZone = account.timezone?.trim() || "Europe/London";
  const { plan } = await ensureDailySendPlan(account, now);
  const [rolling7, accept] = await Promise.all([
    countInvitesInRollingDays(coachId, 7),
    loadInviteAcceptStats(coachId),
  ]);
  const acceptStatus = acceptRateStatus(accept.accepted, accept.sent);
  const recommend = recommendedWeeklyInvites(account.ssi_score);
  const warmupEnabled = account.warmup_enabled !== false;
  const weekIndex = warmupWeekIndex(account.warmup_started_at, now);
  const effective = effectiveWeeklyCap({
    weeklyTarget: account.weekly_invite_target,
    ssiScore: account.ssi_score,
    warmupStartedAt: account.warmup_started_at,
    warmupEnabled,
    now,
  });

  return {
    account: {
      id: account.id,
      weekly_invite_target: account.weekly_invite_target,
      daily_message_target: account.daily_message_target,
      daily_react_target: account.daily_react_target,
      min_action_delay_seconds: account.min_action_delay_seconds,
      max_action_delay_seconds: account.max_action_delay_seconds,
      timezone: timeZone,
      send_rules: parseCampaignSendRules(account.send_rules),
      warmup_started_at: account.warmup_started_at,
      warmup_enabled: warmupEnabled,
      invite_paused_until: account.invite_paused_until,
      rate_limited_until: account.rate_limited_until,
      ssi_score: account.ssi_score,
    },
    recommend,
    effective_weekly_cap: effective,
    warmup_week: weekIndex,
    warmup_complete: weekIndex >= 4,
    rolling_7_sent: rolling7,
    today: plan,
    accept_rate: acceptStatus.rate,
    accept_sample: acceptStatus.sample,
    accept_warn: acceptStatus.warn,
    accept_pause_hint: acceptStatus.pauseHint,
    today_ymd: ymdInTimeZone(now, timeZone),
  };
}

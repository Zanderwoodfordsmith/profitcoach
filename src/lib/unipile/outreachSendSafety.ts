/**
 * Shared LinkedIn outreach send gate: hours, account quotas, campaign daily
 * invite/message limits. Used by the campaign worker and remind fallbacks.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DailySendPlan } from "@/lib/unipile/accountSendSafety";
import {
  bumpDailyPlanAssigned,
  countSucceededActionToday,
  ensureDailySendPlan,
  isInvitePaused,
  isRateLimited,
  loadAccountSendSettings,
  nextActionDelayForAccount,
  type AccountSendSettings,
} from "@/lib/unipile/accountSendPlan";
import {
  clampDailyLimit,
  DAILY_INVITE_LIMIT_MAX,
  DAILY_MESSAGE_LIMIT_MAX,
  nextCampaignSendAt,
  parseCampaignSendRules,
} from "@/lib/unipile/campaignSendWindow";

export const INVITE_STEP_TYPES = ["invite", "instagram_follow"] as const;
export const MESSAGE_STEP_TYPES = ["message", "instagram", "messenger"] as const;
export const REACT_STEP_TYPES = ["react", "instagram_react"] as const;

export const SEND_HOURS_GRACE_MS = 15_000;

export type OutreachSendKind = "invite" | "message" | "react" | "other";

export type OutreachSendSafetyDecision =
  | { ok: true }
  | { ok: false; reason: string; deferUntil: Date };

export type OutreachSendSafetyEvalInput = {
  now: Date;
  sendAt: Date;
  kind: OutreachSendKind;
  rateLimitedUntil: Date | null;
  invitePausedUntil: Date | null;
  plan: Pick<
    DailySendPlan,
    | "invitesAssigned"
    | "inviteQuota"
    | "messagesAssigned"
    | "messageQuota"
    | "reactsAssigned"
    | "reactQuota"
  > | null;
  campaignInvitesToday: number;
  campaignMessagesToday: number;
  campaignInviteLimit: number;
  campaignMessageLimit: number;
  nextWindowStart: Date;
  hoursJitterSeconds: number;
  quotaJitterSeconds: number;
};

export function sendKindFromStepType(stepType: string): OutreachSendKind {
  if ((INVITE_STEP_TYPES as readonly string[]).includes(stepType)) {
    return "invite";
  }
  if ((MESSAGE_STEP_TYPES as readonly string[]).includes(stepType)) {
    return "message";
  }
  if ((REACT_STEP_TYPES as readonly string[]).includes(stepType)) {
    return "react";
  }
  return "other";
}

export function jitterSeconds(min: number, max: number): number {
  return min + Math.floor(Math.random() * Math.max(1, max - min + 1));
}

function jittered(base: Date, extraSeconds: number): Date {
  return new Date(base.getTime() + Math.max(0, extraSeconds) * 1000);
}

export function campaignInviteDailyLimit(value: unknown): number {
  if (value == null || value === "") return 20;
  return clampDailyLimit(value, DAILY_INVITE_LIMIT_MAX, 20);
}

export function campaignMessageDailyLimit(value: unknown): number {
  if (value == null || value === "") return 20;
  return clampDailyLimit(value, DAILY_MESSAGE_LIMIT_MAX, 20);
}

export function evaluateOutreachSendSafety(
  input: OutreachSendSafetyEvalInput
): OutreachSendSafetyDecision {
  const nowMs = input.now.getTime();

  if (
    input.rateLimitedUntil &&
    input.rateLimitedUntil.getTime() > nowMs
  ) {
    return {
      ok: false,
      reason: "Account rate-limited; deferred.",
      deferUntil: input.rateLimitedUntil,
    };
  }

  if (input.sendAt.getTime() > nowMs + SEND_HOURS_GRACE_MS) {
    return {
      ok: false,
      reason: "Outside sending hours; deferred.",
      deferUntil: jittered(input.sendAt, input.hoursJitterSeconds),
    };
  }

  if (
    input.kind === "invite" &&
    input.invitePausedUntil &&
    input.invitePausedUntil.getTime() > nowMs
  ) {
    return {
      ok: false,
      reason: "Invite pause active; deferred.",
      deferUntil: input.invitePausedUntil,
    };
  }

  const quotaDefer = jittered(input.nextWindowStart, input.quotaJitterSeconds);

  if (input.plan) {
    if (
      input.kind === "invite" &&
      input.plan.invitesAssigned >= input.plan.inviteQuota
    ) {
      return {
        ok: false,
        reason: "Account daily limit reached; deferred.",
        deferUntil: quotaDefer,
      };
    }
    if (
      input.kind === "message" &&
      input.plan.messagesAssigned >= input.plan.messageQuota
    ) {
      return {
        ok: false,
        reason: "Account daily limit reached; deferred.",
        deferUntil: quotaDefer,
      };
    }
    if (
      input.kind === "react" &&
      input.plan.reactsAssigned >= input.plan.reactQuota
    ) {
      return {
        ok: false,
        reason: "Account daily limit reached; deferred.",
        deferUntil: quotaDefer,
      };
    }
  }

  if (
    input.kind === "invite" &&
    input.campaignInvitesToday >= input.campaignInviteLimit
  ) {
    return {
      ok: false,
      reason: "Campaign daily invite limit reached; deferred.",
      deferUntil: quotaDefer,
    };
  }

  if (
    input.kind === "message" &&
    input.campaignMessagesToday >= input.campaignMessageLimit
  ) {
    return {
      ok: false,
      reason: "Campaign daily message limit reached; deferred.",
      deferUntil: quotaDefer,
    };
  }

  return { ok: true };
}

export type OutreachCampaignSafetyFields = {
  id: string;
  timezone?: string | null;
  send_rules?: unknown;
  daily_invite_limit?: number | null;
  daily_message_limit?: number | null;
  outreach_account_id?: string | null;
};

export async function checkOutreachSendSafety(input: {
  coachId: string;
  campaign: OutreachCampaignSafetyFields;
  kind: OutreachSendKind;
  sendAccount?: AccountSendSettings | null;
  now?: Date;
}): Promise<{
  result: OutreachSendSafetyDecision;
  sendAccount: AccountSendSettings | null;
  plan: DailySendPlan | null;
  timezone: string;
}> {
  const now = input.now ?? new Date();
  let sendAccount = input.sendAccount ?? null;
  const accountId =
    sendAccount?.id || input.campaign.outreach_account_id || null;
  if (accountId) {
    sendAccount = (await loadAccountSendSettings(accountId)) ?? sendAccount;
  }

  let plan: DailySendPlan | null = null;
  if (sendAccount) {
    const ensured = await ensureDailySendPlan(sendAccount, now);
    sendAccount = ensured.account;
    plan = ensured.plan;
  }

  const timezone =
    sendAccount?.timezone?.trim() ||
    input.campaign.timezone?.trim() ||
    "Europe/London";
  const sendRules = parseCampaignSendRules(
    sendAccount?.send_rules ?? input.campaign.send_rules
  );
  const sendAt = nextCampaignSendAt({ timezone, rules: sendRules, now });
  const nextWindowStart = nextCampaignSendAt({
    timezone,
    rules: sendRules,
    now,
    afterCurrentWindow: true,
  });

  let campaignInvitesToday = 0;
  let campaignMessagesToday = 0;
  if (input.kind === "invite") {
    campaignInvitesToday = await countSucceededActionToday(
      input.coachId,
      [...INVITE_STEP_TYPES],
      timezone,
      input.campaign.id
    );
  } else if (input.kind === "message") {
    campaignMessagesToday = await countSucceededActionToday(
      input.coachId,
      [...MESSAGE_STEP_TYPES],
      timezone,
      input.campaign.id
    );
  }

  const result = evaluateOutreachSendSafety({
    now,
    sendAt,
    kind: input.kind,
    rateLimitedUntil:
      sendAccount && isRateLimited(sendAccount, now)
        ? sendAccount.rate_limited_until
          ? new Date(sendAccount.rate_limited_until)
          : now
        : null,
    invitePausedUntil:
      sendAccount && isInvitePaused(sendAccount, now)
        ? sendAccount.invite_paused_until
          ? new Date(sendAccount.invite_paused_until)
          : new Date(now.getTime() + 3600_000)
        : null,
    plan,
    campaignInvitesToday,
    campaignMessagesToday,
    campaignInviteLimit: campaignInviteDailyLimit(
      input.campaign.daily_invite_limit
    ),
    campaignMessageLimit: campaignMessageDailyLimit(
      input.campaign.daily_message_limit
    ),
    nextWindowStart,
    hoursJitterSeconds: jitterSeconds(60, 900),
    quotaJitterSeconds: jitterSeconds(60, 600),
  });

  return { result, sendAccount, plan, timezone };
}

export async function deferPendingJobsForAccount(input: {
  coachId: string;
  outreachAccountId?: string | null;
  exceptJobId: string;
  deferUntil: Date;
}): Promise<void> {
  let pendingQuery = supabaseAdmin
    .from("linkedin_send_jobs")
    .update({ scheduled_for: input.deferUntil.toISOString() })
    .eq("coach_id", input.coachId)
    .eq("status", "pending")
    .neq("id", input.exceptJobId)
    .lt("scheduled_for", input.deferUntil.toISOString());
  if (input.outreachAccountId) {
    const { data: siblingCampaigns } = await supabaseAdmin
      .from("linkedin_campaigns")
      .select("id")
      .eq("outreach_account_id", input.outreachAccountId);
    const siblingIds = (siblingCampaigns ?? []).map((c) => c.id as string);
    if (siblingIds.length) {
      pendingQuery = pendingQuery.in("campaign_id", siblingIds);
    }
  }
  await pendingQuery;
}

/** After a successful auto/fallback send: pace siblings and consume quota. */
export async function recordSuccessfulOutreachSend(input: {
  coachId: string;
  jobId: string;
  outreachAccountId?: string | null;
  sendAccount: AccountSendSettings | null;
  kind: OutreachSendKind;
  delaySeed: string;
  fallbackDelaySeconds?: number;
}): Promise<void> {
  const delay = input.sendAccount
    ? nextActionDelayForAccount(input.sendAccount, input.delaySeed)
    : Math.max(60, input.fallbackDelaySeconds ?? 180) + jitterSeconds(0, 60);
  await deferPendingJobsForAccount({
    coachId: input.coachId,
    outreachAccountId: input.outreachAccountId,
    exceptJobId: input.jobId,
    deferUntil: new Date(Date.now() + delay * 1000),
  });
  if (!input.sendAccount) return;
  if (input.kind === "invite") {
    await bumpDailyPlanAssigned(input.sendAccount.id, "invite");
  } else if (input.kind === "message") {
    await bumpDailyPlanAssigned(input.sendAccount.id, "message");
  } else if (input.kind === "react") {
    await bumpDailyPlanAssigned(input.sendAccount.id, "react");
  }
}

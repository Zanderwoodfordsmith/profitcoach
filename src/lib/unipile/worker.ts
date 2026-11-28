import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  preferLinkedInUrl,
} from "@/lib/contacts/linkedinIdentity";
import {
  resolveUnipileUser,
  sendUnipileInvitation,
  startUnipileChat,
  commentUnipilePost,
  reactUnipilePost,
  listUnipileUserPosts,
} from "@/lib/unipile/client";
import { buildMessageBody } from "@/lib/unipile/campaigns";
import { consumeNonOutboundSteps, processExpiredInviteTimeouts } from "@/lib/unipile/sequenceAdvance";
import { leadHasWrittenInChat, sendCampaignLinkedInMessage } from "@/lib/unipile/campaignLinkedInSend";
import {
  campaignStepCreatesJob,
  inviteNoConnectFrom,
  isLinkedInOutreachStep,
  messageSendConfigFrom,
} from "@/lib/unipile/campaignStepTypes";
import {
  campaignLeadIsOpenProfile,
  inviteOpenProfileInmailFrom,
  isInmailRejected,
  openInmailText,
  openProfileSendRef,
  ownOpenProfileMessage,
  shouldSendOpenProfileInmail,
  unipileProfileIsOpen,
} from "@/lib/unipile/openProfileInvite";
import {
  engageInstagramLatestPost,
  followInstagramUser,
  followLinkedInUser,
  isMissingChannelContactError,
  sendCampaignChannelMessage,
  sendCampaignEmail,
  sendCampaignWhatsApp,
} from "@/lib/unipile/channelOutreach";
import {
  hrefFromUnipileLinkedIn,
  linkedInPublicIdentifier,
} from "@/lib/unipile/linkedinUrl";
import {
  extractUnipileProfileFields,
  leadFieldsIncomplete,
  mergeLeadFields,
  type OutreachLeadFields,
} from "@/lib/unipile/profileVars";
import {
  loadAccountSendSettings,
  loadCoachLinkedInSendSettings,
  pauseInvitesUntil,
  setRateLimitedUntil,
  type AccountSendSettings,
} from "@/lib/unipile/accountSendPlan";
import {
  checkOutreachSendSafety,
  jitterSeconds,
  recordSuccessfulOutreachSend,
  sendKindFromStepType,
  type OutreachSendSafetyDecision,
} from "@/lib/unipile/outreachSendSafety";
import { normalizeUnipileProvider } from "@/lib/unipile/providers";
import { coachNames, raiseOutreachAlert } from "@/lib/unipile/outreachAlerts";

/** Jobs claimed per cron tick, one per coach, run side by side. */
const MAX_JOBS_PER_TICK = 40;
/** A running campaign's due job waiting longer than this is stuck: alert. */
const STUCK_ALERT_MS = 2 * 3600_000;

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
/** A claimed job still "running" after this died mid-send (functions stop at 60s). */
const STALE_RUNNING_MS = 15 * 60_000;
/** A safety deferral further out than this is a limit or closed hours, not pacing. */
const BULK_DEFER_AFTER_MS = 30 * 60_000;

/**
 * The oldest due job of each running campaign.
 *
 * Until 25 Nov this read the 48 oldest due jobs across everyone. One coach
 * whose account hit its daily limit filled that window (46 of 48 were Andy's)
 * and no other coach sent for 18 hours. One job per campaign means a stuck
 * campaign can never hide another one, and jobs of paused, draft or archived
 * campaigns are never read.
 */
async function loadOldestDueJobPerRunningCampaign(
  now: string
): Promise<Array<Record<string, unknown>>> {
  const { data: campaigns, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .eq("status", "running");
  if (error) throw new Error(error.message);
  const rows = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { data, error: jobErr } = await supabaseAdmin
        .from("linkedin_send_jobs")
        .select("*")
        .eq("campaign_id", c.id as string)
        .eq("status", "pending")
        .lte("scheduled_for", now)
        .order("scheduled_for", { ascending: true })
        .limit(1);
      // One campaign's read failing must not stop everyone else's sends.
      if (jobErr) {
        console.error("outreach candidates:", c.id, jobErr.message);
        return undefined;
      }
      return (data ?? [])[0] as Record<string, unknown> | undefined;
    })
  );
  return rows.filter((r): r is Record<string, unknown> => Boolean(r));
}

async function loadJobsById(
  ids: string[],
  now: string
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("*")
    .in("id", ids)
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Record<string, unknown>>;
}

/**
 * A job left "running" means the function stopped mid-send. It never retries
 * and its lead never moves on. Fail it with a plain reason so it shows up;
 * not retried, because the message may already have gone.
 */
async function releaseStaleRunningJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
  const { data: released } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .update({
      status: "failed",
      last_error:
        "Stopped part-way through sending. Check LinkedIn to see if it went before sending again.",
    })
    .eq("status", "running")
    .lt("updated_at", cutoff)
    .select("coach_id");
  if (!released?.length) return;
  const counts = new Map<string, number>();
  for (const r of released) {
    const id = String(r.coach_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const names = await coachNames([...counts.keys()]);
  for (const [coachId, n] of counts) {
    const name = names.get(coachId) ?? "A coach";
    await raiseOutreachAlert({
      title: `Sales Robot: a send stopped part-way for ${name}`,
      details: `${n} send${n === 1 ? "" : "s"} for ${name} stopped mid-way and ${n === 1 ? "was" : "were"} marked failed. It may or may not have reached LinkedIn, so it was not sent again. Check their LinkedIn and the campaign's failed leads.`,
    });
  }
}

/**
 * Any running campaign whose oldest due job has waited over 2 hours is not
 * being worked: tell BCA, once per coach until the ticket is resolved.
 * Limits and closed hours move jobs forward, so they never look stuck.
 */
async function alertStuckCampaigns(
  candidates: Array<Record<string, unknown>>,
  pickedIds: Set<string>
): Promise<void> {
  const cutoff = Date.now() - STUCK_ALERT_MS;
  // A coach who got a turn this run is being worked; their campaigns take turns.
  const workedCoaches = new Set(
    candidates.filter((j) => pickedIds.has(String(j.id))).map((j) => String(j.coach_id))
  );
  const stuck = candidates.filter(
    (j) =>
      !workedCoaches.has(String(j.coach_id)) &&
      new Date(String(j.scheduled_for)).getTime() < cutoff
  );
  if (!stuck.length) return;
  const byCoach = new Map<string, Array<Record<string, unknown>>>();
  for (const j of stuck) {
    const id = String(j.coach_id);
    byCoach.set(id, [...(byCoach.get(id) ?? []), j]);
  }
  const { data: campaigns } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, name")
    .in("id", stuck.map((j) => String(j.campaign_id)));
  const campaignName = new Map(
    (campaigns ?? []).map((c) => [c.id as string, (c.name as string) || "Campaign"])
  );
  const names = await coachNames([...byCoach.keys()]);
  for (const [coachId, jobs] of byCoach) {
    const name = names.get(coachId) ?? "A coach";
    const lines = jobs.map((j) => {
      const hours = Math.round(
        (Date.now() - new Date(String(j.scheduled_for)).getTime()) / 3600_000
      );
      return `- ${campaignName.get(String(j.campaign_id)) ?? "Campaign"}: waiting ${hours} hours`;
    });
    await raiseOutreachAlert({
      title: `Sales Robot: ${name}'s sends are stuck`,
      details: `These campaigns have sends due that the Sales Robot has not picked up:\n${lines.join("\n")}\n\nOther coaches keep sending. Check the campaign and their LinkedIn connection.`,
    });
  }
}

/**
 * A limit or closed hours holds more than this one job. Move every due job it
 * holds together so the queue does not re-check them one per tick:
 * - scope "campaign": closed hours or a rate limit, nothing in it can send
 * - stepType: a limit for that kind of send
 * - stepId: just that step (an Open Profile InMail at its message limit)
 */
async function deferCampaignJobs(input: {
  campaignId: string;
  deferUntil: Date;
  reason: string;
  scope: "campaign" | { stepType: string } | { stepId: string };
}): Promise<void> {
  let stepIds: string[] | null = null;
  if (input.scope !== "campaign" && "stepId" in input.scope) {
    stepIds = [input.scope.stepId];
  } else if (input.scope !== "campaign") {
    const stepType = input.scope.stepType;
    const { data: steps } = await supabaseAdmin
      .from("linkedin_campaign_steps")
      .select("id, config")
      .eq("campaign_id", input.campaignId)
      .eq("step_type", stepType);
    // Invite steps that fall back to Open Profile InMail use the message
    // quota, so an invite limit must not hold them.
    stepIds = (steps ?? [])
      .filter((s) => stepType !== "invite" || !inviteOpenProfileInmailFrom(s.config))
      .map((s) => s.id as string);
    if (!stepIds.length) return;
  }
  let query = supabaseAdmin
    .from("linkedin_send_jobs")
    .update({
      scheduled_for: input.deferUntil.toISOString(),
      last_error: input.reason,
    })
    .eq("campaign_id", input.campaignId)
    .eq("status", "pending")
    .lt("scheduled_for", input.deferUntil.toISOString());
  if (stepIds) query = query.in("step_id", stepIds);
  await query;
}

/**
 * Invites are held but the step can still send Open Profile InMails, so its
 * jobs can't all move together. Those whose lead is known not to be Open
 * Profile can't send at all: move them in one go. Until 26 Nov they were
 * re-checked one per run (SUP-0700: 81 of Paul's invites sat hours late and
 * his follow-up messages waited behind them).
 */
async function deferClosedProfileInvites(input: {
  campaignId: string;
  stepId: string;
  deferUntil: Date;
  reason: string;
}): Promise<void> {
  const until = input.deferUntil.toISOString();
  const { data } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("id, linkedin_campaign_leads!inner(open_profile)")
    .eq("campaign_id", input.campaignId)
    .eq("step_id", input.stepId)
    .eq("status", "pending")
    .lt("scheduled_for", until)
    .eq("linkedin_campaign_leads.open_profile", false)
    .limit(1000);
  const ids = (data ?? []).map((j) => j.id as string);
  for (let i = 0; i < ids.length; i += 200) {
    await supabaseAdmin
      .from("linkedin_send_jobs")
      .update({ scheduled_for: until, last_error: input.reason })
      .in("id", ids.slice(i, i + 200))
      .eq("status", "pending");
  }
}

/** Reasons from the safety check that stop every kind of send, InMail included. */
function blocksWholeCampaign(reason: string): boolean {
  return /^Outside sending hours|^Account rate-limited/.test(reason);
}

function isFarDefer(deferUntil: Date): boolean {
  return deferUntil.getTime() - Date.now() > BULK_DEFER_AFTER_MS;
}

function isCannotResendYet(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /cannot_resend_yet|422/i.test(message);
}

function isHttp429(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /too many requests|\b429\b/i.test(message);
}

/** LinkedIn's account-wide limits, which arrive as plain sentences, not codes. */
function isProviderLimit(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /temporary provider limit|usage limit set by the provider/i.test(message);
}

/** The note is longer than this account allows (200 on free LinkedIn, 300 on Premium). */
function isNoteTooLong(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /exceeds the character limit/i.test(message);
}

/** A follow-up into an Open Profile message they haven't answered: LinkedIn blocks it. */
function isInmailNotAccepted(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /hasn't accepted your inmail|has not accepted your inmail/i.test(message);
}

/**
 * At most one due outbound job per outreach account (and per coach without one).
 * Prefer earlier scheduled_for, then higher-priority campaigns.
 */
async function pickJobsOnePerAccount(
  candidates: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  if (!candidates.length) return [];
  const campaignIds = [
    ...new Set(candidates.map((j) => String(j.campaign_id || ""))),
  ].filter(Boolean);
  const { data: campaigns } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, outreach_account_id, outreach_priority, outreach_weight, status")
    .in("id", campaignIds);
  const byId = new Map(
    (campaigns ?? []).map((c) => [c.id as string, c] as const)
  );

  const ranked = [...candidates].sort((a, b) => {
    const ca = byId.get(String(a.campaign_id));
    const cb = byId.get(String(b.campaign_id));
    const pa = Number(ca?.outreach_priority ?? 100);
    const pb = Number(cb?.outreach_priority ?? 100);
    if (pa !== pb) return pa - pb;
    const wa = Number(cb?.outreach_weight ?? 1) - Number(ca?.outreach_weight ?? 1);
    if (wa !== 0) return wa;
    return String(a.scheduled_for).localeCompare(String(b.scheduled_for));
  });

  const picked: Array<Record<string, unknown>> = [];
  const seenAccounts = new Set<string>();
  for (const job of ranked) {
    if (picked.length >= MAX_JOBS_PER_TICK) break;
    const campaign = byId.get(String(job.campaign_id));
    if (!campaign || campaign.status !== "running") continue;
    // One slot per coach per run. Jobs run side by side, and a campaign wired
    // to a mail row is swapped to the coach's LinkedIn mid-run, so per-account
    // keys could send twice from one LinkedIn within seconds. Per coach, no
    // coach can ever take another coach's turn.
    const accountKey = `coach:${String(job.coach_id)}`;
    if (seenAccounts.has(accountKey)) continue;
    seenAccounts.add(accountKey);
    picked.push(job);
  }
  return picked;
}

async function resolveProviderId(
  lead: {
    id: string;
    linkedin_url: string | null;
    linkedin_provider_id: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
    title?: string | null;
    metadata: Record<string, unknown> | null;
  },
  accountId: string,
  opts?: { forceProfile?: boolean }
): Promise<{
  providerId: string | null;
  openProfile: boolean | null;
  lead: OutreachLeadFields & {
    id: string;
    linkedin_provider_id?: string | null;
  };
}> {
  let enriched: OutreachLeadFields & {
    id: string;
    linkedin_provider_id?: string | null;
  } = {
    id: lead.id,
    first_name: lead.first_name ?? null,
    last_name: lead.last_name ?? null,
    company: lead.company ?? null,
    title: lead.title ?? null,
    city: (lead.metadata?.city as string | undefined) || null,
    location: (lead.metadata?.location as string | undefined) || null,
    linkedin_provider_id: lead.linkedin_provider_id ?? null,
  };

  const needsProfile =
    !lead.linkedin_provider_id ||
    leadFieldsIncomplete(enriched) ||
    // Also resolve when we only have an ACo… URL so we can store vanity.
    Boolean(
      lead.linkedin_url &&
        /^https?:\/\/(www\.)?linkedin\.com\/in\/AC[ow]/i.test(
          lead.linkedin_url
        )
    );

  if (!needsProfile && !opts?.forceProfile) {
    return {
      providerId: lead.linkedin_provider_id,
      openProfile: null,
      lead: enriched,
    };
  }

  const pub =
    (lead.metadata?.public_identifier as string | undefined) ||
    (lead.linkedin_url ? linkedInPublicIdentifier(lead.linkedin_url) : null);

  if (!pub && !lead.linkedin_provider_id) {
    return { providerId: null, openProfile: null, lead: enriched };
  }

  const identifier = pub || lead.linkedin_provider_id!;
  const resolved = await resolveUnipileUser(identifier, accountId);
  if (!resolved.ok || !resolved.data) {
    return {
      providerId: lead.linkedin_provider_id,
      openProfile: null,
      lead: enriched,
    };
  }

  const data = resolved.data as Record<string, unknown>;
  const openProfile = unipileProfileIsOpen(data);
  const providerId =
    (data.provider_id as string | undefined) ||
    (data.id as string | undefined) ||
    lead.linkedin_provider_id ||
    null;

  enriched = {
    id: lead.id,
    linkedin_provider_id: providerId,
    ...mergeLeadFields(enriched, extractUnipileProfileFields(data)),
  };

  if (providerId) {
    const publicIdentifier =
      (data.public_identifier as string | undefined) ||
      (lead.metadata?.public_identifier as string | undefined) ||
      pub;
    const resolvedUrl = preferLinkedInUrl(
      lead.linkedin_url,
      hrefFromUnipileLinkedIn(
        typeof data.public_profile_url === "string"
          ? data.public_profile_url
          : null,
        publicIdentifier
      )
    );

    await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({
        linkedin_provider_id: providerId,
        ...(resolvedUrl ? { linkedin_url: resolvedUrl } : {}),
        first_name: enriched.first_name,
        last_name: enriched.last_name,
        company: enriched.company,
        title: enriched.title,
        metadata: {
          ...((lead.metadata as Record<string, unknown>) || {}),
          city: enriched.city,
          location: enriched.location,
          public_identifier: publicIdentifier,
          ...(openProfile != null ? { open_profile: openProfile } : {}),
        },
        ...(openProfile != null ? { open_profile: openProfile } : {}),
      })
      .eq("id", lead.id);
  }

  return { providerId, openProfile, lead: enriched };
}

export async function advanceLeadAfterStep(input: {
  lead: Record<string, unknown>;
  campaignId: string;
  coachId: string;
  nextPosition: number;
  patch?: Record<string, unknown>;
}) {
  const { jobStatusForStep } = await import("@/lib/unipile/remindQueue");
  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("*")
    .eq("campaign_id", input.campaignId)
    .order("position", { ascending: true });

  const consumed = await consumeNonOutboundSteps({
    steps: (steps ?? []) as Array<{
      id?: string;
      position: number;
      step_type: string;
      wait_hours?: number | null;
      config?: unknown;
    }>,
    lead: input.lead,
    campaignId: input.campaignId,
    coachId: input.coachId,
    startPosition: input.nextPosition,
  });

  const pos = consumed.position;
  const nextAction = consumed.nextAction;
  let status = consumed.completed ? "completed" : "in_sequence";

  const finalStep = (steps ?? []).find((s) => s.position === pos);
  if (!finalStep) status = "completed";

  await supabaseAdmin
    .from("linkedin_campaign_leads")
    .update({
      current_step_position: pos,
      next_action_at: status === "completed" ? null : nextAction.toISOString(),
      status:
        status === "completed"
          ? "completed"
          : (input.patch?.status as string) || status,
      last_error: null,
      ...input.patch,
    })
    .eq("id", input.lead.id);

  const nextStatus =
    status === "completed"
      ? "completed"
      : (input.patch?.status as string) || status;
  if (nextStatus === "connected" || nextStatus === "completed") {
    const { fireCoachWatchRulesSafe } = await import("@/lib/coachWatch/fire");
    fireCoachWatchRulesSafe({
      coachId: input.coachId,
      scopeKind: "campaign",
      scopeId: input.campaignId,
      event: nextStatus === "connected" ? "connected" : "sequence_done",
      personName: [input.lead.first_name, input.lead.last_name]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (
    status !== "completed" &&
    finalStep &&
    campaignStepCreatesJob(String(finalStep.step_type), finalStep.config)
  ) {
    const jobStatus = jobStatusForStep(
      finalStep.step_type === "message"
        ? (finalStep.send_mode as string | null)
        : "auto",
      String(finalStep.step_type)
    );
    await supabaseAdmin.from("linkedin_send_jobs").insert({
      coach_id: input.coachId,
      campaign_id: input.campaignId,
      lead_id: input.lead.id,
      step_id: finalStep.id,
      scheduled_for: nextAction.toISOString(),
      status: jobStatus,
    });
  }
}

/** Called when LinkedIn reports a new connection (invite accepted). */
export async function advanceLeadAfterInviteAccepted(input: {
  lead: Record<string, unknown>;
  campaignId: string;
  coachId: string;
  providerId?: string | null;
}) {
  const currentPos = Number(input.lead.current_step_position ?? 0);
  await advanceLeadAfterStep({
    lead: input.lead,
    campaignId: input.campaignId,
    coachId: input.coachId,
    nextPosition: currentPos + 1,
    patch: {
      status: "connected",
      ...(input.providerId
        ? { linkedin_provider_id: input.providerId }
        : {}),
    },
  });
}

export async function processOutreachJobsTick(options?: {
  /** Run only these send jobs (a one-job test); the cron passes nothing. */
  onlyJobIds?: string[];
}): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const only = options?.onlyJobIds?.length ? options.onlyJobIds : null;
  // Each side queue is fenced off: if one throws, sends still run.
  let fallback = { processed: 0, succeeded: 0, failed: 0, errors: [] as string[] };
  if (!only) {
    try {
      const { processRemindFallbacks } = await import("@/lib/unipile/remindQueue");
      fallback = await processRemindFallbacks();
    } catch (err) {
      await raiseOutreachAlert({
        title: "Sales Robot: reminder fallback sends failed",
        details: `Reminders that should auto-send after their wait did not run.\n\nError: ${errText(err)}`,
      });
    }
    try {
      await processExpiredInviteTimeouts();
    } catch (err) {
      await raiseOutreachAlert({
        title: "Sales Robot: moving unaccepted invites failed",
        details: `Leads who didn't accept an invite were not moved to their next campaign.\n\nError: ${errText(err)}`,
      });
    }
    await releaseStaleRunningJobs();
  }

  const now = new Date().toISOString();
  const candidates = only
    ? await loadJobsById(only, now)
    : await loadOldestDueJobPerRunningCampaign(now);

  const jobs = await pickJobsOnePerAccount(candidates);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  // One job per coach, all at once: a slow or broken account can't use up
  // the run's 60 seconds and leave other coaches unsent.
  await Promise.allSettled(jobs.map(async (rawJob) => {
    processed += 1;
    const job = {
      ...rawJob,
      id: String(rawJob.id),
      coach_id: String(rawJob.coach_id),
      campaign_id: String(rawJob.campaign_id),
      lead_id: String(rawJob.lead_id),
      step_id: String(rawJob.step_id),
      attempts: Number(rawJob.attempts) || 0,
    };
    const claim = await supabaseAdmin
      .from("linkedin_send_jobs")
      .update({ status: "running", attempts: job.attempts + 1 })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claim.data) return;

    try {
      const { data: campaign } = await supabaseAdmin
        .from("linkedin_campaigns")
        .select(
          "*, linkedin_outreach_accounts(id, unipile_account_id, status, provider, timezone, send_rules, weekly_invite_target, daily_message_target, daily_react_target, min_action_delay_seconds, max_action_delay_seconds, warmup_started_at, invite_paused_until, rate_limited_until, daily_send_plan, ssi_score, coach_id)"
        )
        .eq("id", job.campaign_id)
        .maybeSingle();

      if (!campaign || campaign.status !== "running") {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({ status: "cancelled", last_error: "Campaign not running" })
          .eq("id", job.id);
        return;
      }

      const { data: step } = await supabaseAdmin
        .from("linkedin_campaign_steps")
        .select("*")
        .eq("id", job.step_id)
        .maybeSingle();
      const { data: lead } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("*")
        .eq("id", job.lead_id)
        .maybeSingle();
      if (!step || !lead) throw new Error("Step or lead missing.");

      // Remind / call steps must never auto-run — park for coach.
      if (
        step.step_type === "call" ||
        (step.step_type === "message" &&
          (step.send_mode as string) === "remind")
      ) {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({
            status: "awaiting_coach",
            last_error: null,
          })
          .eq("id", job.id);
        return;
      }

      // Email campaigns (BOSS Score report and follow-ups) send from the coach's
      // own mailbox through the email step below. Until 20 Nov they were
      // cancelled here, so no BOSS Score email ever went from the app.
      if ((campaign.channel as string | undefined) === "email") {
        const { resolveAccountIdForChannel } = await import("@/lib/messaging/startConversation");
        if (!(await resolveAccountIdForChannel(job.coach_id, "email"))) {
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({
              status: "pending",
              scheduled_for: new Date(Date.now() + 6 * 3600_000).toISOString(),
              last_error: "Connect Gmail or Outlook in Settings before this step can send.",
            })
            .eq("id", job.id);
          return;
        }
      }

      const accountRel = campaign.linkedin_outreach_accounts as
        | AccountSendSettings
        | AccountSendSettings[]
        | null;
      let sendAccount = (
        Array.isArray(accountRel) ? accountRel[0] : accountRel
      ) as AccountSendSettings | null;

      if (campaign.outreach_account_id && !sendAccount) {
        sendAccount = await loadAccountSendSettings(
          campaign.outreach_account_id as string
        );
      }

      // Never send from, or use up the limits of, another coach's account.
      if (sendAccount?.coach_id && sendAccount.coach_id !== job.coach_id) {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({
            status: "pending",
            scheduled_for: new Date(Date.now() + 6 * 3600_000).toISOString(),
            last_error: "This campaign is set to send from another coach's account.",
          })
          .eq("id", job.id);
        const names = await coachNames([job.coach_id, sendAccount.coach_id]);
        await raiseOutreachAlert({
          title: `Sales Robot: ${names.get(job.coach_id) ?? "A coach"}'s campaign uses another coach's account`,
          details: `The campaign "${String(campaign.name ?? "")}" for ${names.get(job.coach_id) ?? "this coach"} is set to send from ${names.get(sendAccount.coach_id) ?? "another coach"}'s account. Nothing was sent. Pick the coach's own account in the campaign settings.`,
        });
        return;
      }

      const stepType = step.step_type as string;
      let sendKind = sendKindFromStepType(stepType);
      let inviteSafetyFail: Extract<
        OutreachSendSafetyDecision,
        { ok: false }
      > | null = null;

      const safety = await checkOutreachSendSafety({
        coachId: job.coach_id,
        campaign: {
          id: String(campaign.id),
          timezone: campaign.timezone as string | null,
          send_rules: campaign.send_rules,
          daily_invite_limit: campaign.daily_invite_limit as number | null,
          daily_message_limit: campaign.daily_message_limit as number | null,
          outreach_account_id: campaign.outreach_account_id as string | null,
        },
        kind: sendKind,
        sendAccount,
      });
      sendAccount = safety.sendAccount;
      if (!safety.result.ok && blocksWholeCampaign(safety.result.reason)) {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({
            status: "pending",
            scheduled_for: safety.result.deferUntil.toISOString(),
            last_error: safety.result.reason,
          })
          .eq("id", job.id);
        if (isFarDefer(safety.result.deferUntil)) {
          await deferCampaignJobs({
            campaignId: job.campaign_id,
            deferUntil: safety.result.deferUntil,
            reason: safety.result.reason,
            scope: "campaign",
          });
        }
        return;
      }
      if (!safety.result.ok) {
        // Invite quota is full — still try Open Profile InMail (message quota).
        if (
          stepType === "invite" &&
          inviteOpenProfileInmailFrom(step.config)
        ) {
          inviteSafetyFail = safety.result;
          if (isFarDefer(safety.result.deferUntil)) {
            await deferClosedProfileInvites({
              campaignId: job.campaign_id,
              stepId: String(step.id),
              deferUntil: safety.result.deferUntil,
              reason: safety.result.reason,
            });
          }
        } else {
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({
              status: "pending",
              scheduled_for: safety.result.deferUntil.toISOString(),
              last_error: safety.result.reason,
            })
            .eq("id", job.id);
          if (isFarDefer(safety.result.deferUntil)) {
            await deferCampaignJobs({
              campaignId: job.campaign_id,
              deferUntil: safety.result.deferUntil,
              reason: safety.result.reason,
              scope: { stepType },
            });
          }
          return;
        }
      }

      const linkedInAccountId = sendAccount?.unipile_account_id;
      const needsLinkedIn = isLinkedInOutreachStep(stepType);

      // Campaigns sometimes get a Gmail/Outlook row as outreach_account_id
      // (accounts list order). Unipile user resolve then fails forever — swap
      // to the coach's LinkedIn account before burning leads.
      if (needsLinkedIn) {
        const provider = normalizeUnipileProvider(sendAccount?.provider);
        if (!sendAccount || provider !== "LINKEDIN") {
          const linkedIn = await loadCoachLinkedInSendSettings(job.coach_id);
          if (linkedIn) {
            sendAccount = linkedIn;
            if (campaign.outreach_account_id !== linkedIn.id) {
              await supabaseAdmin
                .from("linkedin_campaigns")
                .update({ outreach_account_id: linkedIn.id })
                .eq("id", campaign.id);
            }
          }
        }
      }

      if (
        needsLinkedIn &&
        (!sendAccount?.unipile_account_id || sendAccount?.status === "CREDENTIALS")
      ) {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({
            status: "pending",
            scheduled_for: new Date(Date.now() + 30 * 60_000).toISOString(),
            last_error: "LinkedIn account missing or disconnected.",
          })
          .eq("id", job.id);
        const names = await coachNames([job.coach_id]);
        const name = names.get(job.coach_id) ?? "A coach";
        await raiseOutreachAlert({
          title: `Sales Robot: ${name}'s LinkedIn is disconnected`,
          details: `${name} has a running campaign ("${String(campaign.name ?? "")}") but their LinkedIn account is missing or needs signing in again, so nothing can send. They need to reconnect LinkedIn in Settings.`,
        });
        return;
      }
      const accountId = sendAccount?.unipile_account_id ?? "";

      if (
        [
          "replied",
          "interested",
          "assessment_sent",
          "assessment_done",
          "call_offered",
          "paused",
          "failed",
          "completed",
          "skipped",
        ].includes(lead.status as string)
      ) {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({
            status: "cancelled",
            last_error: `Lead status ${lead.status}`,
          })
          .eq("id", job.id);
        return;
      }

      let providerId: string | null = lead.linkedin_provider_id as string | null;
      let leadForMessage = lead;
      let openProfile = campaignLeadIsOpenProfile(
        lead as { open_profile?: unknown; metadata?: unknown }
      );
      if (needsLinkedIn) {
        const resolved = await resolveProviderId(
          lead as {
            id: string;
            linkedin_url: string | null;
            linkedin_provider_id: string | null;
            first_name?: string | null;
            last_name?: string | null;
            company?: string | null;
            title?: string | null;
            metadata: Record<string, unknown> | null;
          },
          accountId,
          {
            forceProfile:
              stepType === "invite" &&
              inviteOpenProfileInmailFrom(step.config) &&
              openProfile == null,
          }
        );
        providerId = resolved.providerId;
        if (resolved.openProfile != null) openProfile = resolved.openProfile;
        if (!providerId) {
          // Soft-fail: keep the lead queued and try someone else next tick.
          // Hard-failing here burned whole lists when the wrong account was wired.
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({
              status: "pending",
              scheduled_for: new Date(Date.now() + 6 * 3600_000).toISOString(),
              last_error: "Could not resolve LinkedIn provider id.",
            })
            .eq("id", job.id);
          await supabaseAdmin
            .from("linkedin_campaign_leads")
            .update({ last_error: "Could not resolve LinkedIn provider id." })
            .eq("id", lead.id);
          return;
        }
        leadForMessage = { ...lead, ...resolved.lead };
      }

      const { resolveStepBodyForLead, buildLeadAssessmentUrl, buildLeadAssessmentProUrl } = await import(
        "@/lib/unipile/interest"
      );
      const { data: coachRow } = await supabaseAdmin
        .from("profiles")
        .select("full_name, first_name")
        .eq("id", job.coach_id)
        .maybeSingle();
      const coachName =
        (coachRow?.full_name as string) ||
        (coachRow?.first_name as string) ||
        "";
      const assessmentUrl = await buildLeadAssessmentUrl({
        coachId: job.coach_id,
        contactId: (lead.contact_id as string | null) ?? null,
        firstName: leadForMessage.first_name as string | null,
        lastName: leadForMessage.last_name as string | null,
        company: leadForMessage.company as string | null,
      });
      const assessmentProUrl = await buildLeadAssessmentProUrl({
        coachId: job.coach_id,
        contactId: (lead.contact_id as string | null) ?? null,
        firstName: leadForMessage.first_name as string | null,
        lastName: leadForMessage.last_name as string | null,
        company: leadForMessage.company as string | null,
      });
      const { loadScorecardOutreachVars } = await import(
        "@/lib/unipile/scorecardVars"
      );
      const scorecardVars = await loadScorecardOutreachVars({
        coachId: job.coach_id,
        contactId: (lead.contact_id as string | null) ?? null,
      });
      const { bookingLinkForCoachLead } = await import("@/lib/booking/leadLink");
      const bookingLink = await bookingLinkForCoachLead(job.coach_id, lead.id as string);
      const { reviewCallName } = await import("@/lib/scorecardFollowUp");
      const reviewName = await reviewCallName(job.coach_id);
      const templateExtras = {
        booking_link: bookingLink,
        assessment_url: assessmentUrl,
        scorecard_url: assessmentUrl,
        scorecard_link: assessmentUrl,
        assessment_pro_url: assessmentProUrl,
        coach_name: coachName,
        review_name: reviewName,
        ...(scorecardVars ?? {}),
        boss_score_report_link:
          scorecardVars?.boss_score_report_link || assessmentUrl || "",
      };

      async function renderedStepBody() {
        const picked = await resolveStepBodyForLead({
          leadId: lead.id as string,
          stepId: step.id as string,
          body: (step.body as string) || "",
          variants: step.variants,
          abAssignments: lead.ab_assignments,
          preferredVariantKey: scorecardVars?.business_level_number || null,
        });
        // Never send a placeholder nothing fills in (e.g. {{market_observation}}) as a blank.
        const { unknownTokens } = await import("@/lib/campaigns/launchCheck");
        const unfilled = unknownTokens(picked.body);
        if (unfilled.length) {
          throw new Error(`Write your own words in place of ${unfilled.join(", ")} before this step can send.`);
        }
        let extras: Record<string, string | null | undefined> = templateExtras;
        if (/\{\{\s*profile_hook\s*\}\}/i.test(picked.body)) {
          const { profileHookForLead } = await import("@/lib/groupTests/profileHook");
          const meta = (leadForMessage.metadata ?? null) as Record<string, unknown> | null;
          const hook = await profileHookForLead({
            leadId: lead.id as string,
            accountId: accountId as string,
            identifier:
              (leadForMessage.linkedin_provider_id as string | null) ||
              (typeof meta?.public_identifier === "string" ? meta.public_identifier : null),
            company: (leadForMessage.company as string | null) ?? null,
            metadata: meta,
          });
          extras = { ...templateExtras, profile_hook: hook };
        }
        const { usesTheirBusiness, theirBusinessForLead } = await import("@/lib/campaigns/theirBusiness");
        if (usesTheirBusiness(picked.body)) {
          extras = { ...extras, their_business: await theirBusinessForLead(lead.id as string) };
        }
        let text = buildMessageBody(picked.body, leadForMessage, extras);
        // LinkedIn cuts a note at 300: drop the town before the ending gets cut.
        if (step.step_type === "invite" && text.length > 300 && extras.their_business) {
          const shorter = String(extras.their_business).replace(/ in .+$/, "");
          text = buildMessageBody(picked.body, leadForMessage, { ...extras, their_business: shorter });
        }
        return {
          text,
          variantKey: picked.variantKey,
          variant: picked.variant,
        };
      }

      let providerRef: string | null = null;

      if (step.step_type === "invite") {
        const { text: note } = await renderedStepBody();
        const ownMessage = ownOpenProfileMessage(step.config);
        const { usesTheirBusiness, theirBusinessForLead } = await import("@/lib/campaigns/theirBusiness");
        const ownExtras =
          ownMessage && usesTheirBusiness(ownMessage)
            ? { ...templateExtras, their_business: await theirBusinessForLead(lead.id as string) }
            : templateExtras;
        const inmailSource = ownMessage
          ? buildMessageBody(ownMessage, leadForMessage, ownExtras)
          : note;
        let sentOpenProfile = false;
        if (
          shouldSendOpenProfileInmail({
            stepType,
            config: step.config,
            openProfile,
            note: inmailSource,
          })
        ) {
          const inmailText = openInmailText(inmailSource);
          const messageSafety = await checkOutreachSendSafety({
            coachId: job.coach_id,
            campaign: {
              id: String(campaign.id),
              timezone: campaign.timezone as string | null,
              send_rules: campaign.send_rules,
              daily_invite_limit: campaign.daily_invite_limit as number | null,
              daily_message_limit: campaign.daily_message_limit as number | null,
              outreach_account_id: campaign.outreach_account_id as string | null,
            },
            kind: "message",
            sendAccount,
          });
          sendAccount = messageSafety.sendAccount;
          if (!messageSafety.result.ok) {
            await supabaseAdmin
              .from("linkedin_send_jobs")
              .update({
                status: "pending",
                scheduled_for: messageSafety.result.deferUntil.toISOString(),
                last_error: messageSafety.result.reason,
              })
              .eq("id", job.id);
            if (isFarDefer(messageSafety.result.deferUntil)) {
              await deferCampaignJobs({
                campaignId: job.campaign_id,
                deferUntil: messageSafety.result.deferUntil,
                reason: messageSafety.result.reason,
                scope: { stepId: String(step.id) },
              });
            }
            return;
          }
          const res = await startUnipileChat({
            account_id: accountId,
            attendees_ids: [providerId as string],
            text: inmailText as string,
            inmail: true,
          });
          if (res.ok) {
            sentOpenProfile = true;
            sendKind = "message";
            const chatId = res.data?.chat_id ?? null;
            providerRef = openProfileSendRef(
              chatId,
              res.data?.message_id ?? null
            );
            const metadata = {
              ...((lead.metadata as Record<string, unknown>) || {}),
              open_profile_sent: true,
              open_profile: true,
            };
            await advanceLeadAfterStep({
              lead,
              campaignId: job.campaign_id,
              coachId: job.coach_id,
              nextPosition: (step.position as number) + 1,
              patch: {
                status: "in_sequence",
                metadata,
                open_profile: true,
                ...(chatId ? { unipile_chat_id: chatId } : {}),
              },
            });
          } else if (!isInmailRejected(res)) {
            throw new Error(res.error || "Open Profile message failed");
          }
        }

        if (!sentOpenProfile) {
          if (inviteSafetyFail) {
            await supabaseAdmin
              .from("linkedin_send_jobs")
              .update({
                status: "pending",
                scheduled_for: inviteSafetyFail.deferUntil.toISOString(),
                last_error: inviteSafetyFail.reason,
              })
              .eq("id", job.id);
            return;
          }
          const res = await sendUnipileInvitation({
            account_id: accountId,
            provider_id: providerId as string,
            message: note || undefined,
          });
          if (!res.ok) {
            // already connected → treat as success path into messaging
            if (
              String(res.error || "").includes("already_connected") ||
              (res.raw as { type?: string })?.type === "errors/already_connected"
            ) {
              await advanceLeadAfterStep({
                lead,
                campaignId: job.campaign_id,
                coachId: job.coach_id,
                nextPosition: (step.position as number) + 1,
                patch: { status: "connected" },
              });
              await supabaseAdmin
                .from("linkedin_send_jobs")
                .update({ status: "succeeded", provider_ref: "already_connected" })
                .eq("id", job.id);
              succeeded += 1;
              return;
            }
            throw new Error(res.error || "Invite failed");
          }
          providerRef = res.data?.invitation_id ?? null;
          const noConnect = inviteNoConnectFrom(step.config);
          const timeoutAt =
            noConnect.on_no_connect === "other_campaign" &&
            noConnect.no_connect_wait_hours
              ? new Date(
                  Date.now() + noConnect.no_connect_wait_hours * 3600 * 1000
                ).toISOString()
              : null;
          // Stay on invite step until new_relation webhook (accept) advances,
          // or the no-connect wait fires.
          await supabaseAdmin
            .from("linkedin_campaign_leads")
            .update({
              status: "invited",
              invitation_id: providerRef,
              last_error: null,
              ...(openProfile != null ? { open_profile: openProfile } : {}),
              next_action_at: timeoutAt,
            })
            .eq("id", lead.id);
        }
      } else if (step.step_type === "message") {
        // Already talking (e.g. replied before this campaign was imported):
        // a sequence message would read as a cold, repeated message. Stop here.
        if (
          await leadHasWrittenInChat({
            chatId: (lead.unipile_chat_id as string | null) ?? null,
            providerId,
            accountId,
          })
        ) {
          await supabaseAdmin
            .from("linkedin_campaign_leads")
            .update({ status: "replied", next_action_at: null })
            .eq("id", lead.id);
          const { cancelOpenSendJobs } = await import("@/lib/unipile/remindQueue");
          await cancelOpenSendJobs(
            lead.id as string,
            "Not sent: this person has already written to the coach on LinkedIn."
          );
          return;
        }
        const { text, variant } = await renderedStepBody();
        const sent = await sendCampaignLinkedInMessage({
          coachId: job.coach_id,
          campaignId: job.campaign_id,
          accountId,
          providerId: providerId as string,
          lead,
          text,
          stepConfig: messageSendConfigFrom(step.config, variant),
        });
        providerRef = sent.messageId;
        await advanceLeadAfterStep({
          lead,
          campaignId: job.campaign_id,
          coachId: job.coach_id,
          nextPosition: (step.position as number) + 1,
          patch: { status: "in_sequence" },
        });
      } else if (step.step_type === "visit") {
        const meta = (lead.metadata || {}) as Record<string, unknown>;
        const pub =
          (meta.public_identifier as string | undefined) ||
          (lead.linkedin_url
            ? linkedInPublicIdentifier(lead.linkedin_url as string)
            : null) ||
          providerId;
        if (!pub) throw new Error("No profile identifier for visit.");
        const res = await resolveUnipileUser(String(pub), accountId, {
          notify: true,
        });
        if (!res.ok) throw new Error(res.error || "Profile visit failed");
        providerRef = String(pub);
        await advanceLeadAfterStep({
          lead,
          campaignId: job.campaign_id,
          coachId: job.coach_id,
          nextPosition: (step.position as number) + 1,
          patch: { status: "in_sequence" },
        });
      } else if (step.step_type === "follow") {
        const meta = (lead.metadata || {}) as Record<string, unknown>;
        const pub =
          (meta.public_identifier as string | undefined) ||
          (lead.linkedin_url
            ? linkedInPublicIdentifier(lead.linkedin_url as string)
            : null) ||
          providerId;
        if (!pub) throw new Error("No profile identifier to follow.");
        providerRef = await followLinkedInUser({
          accountId,
          identifier: String(pub),
        });
        await advanceLeadAfterStep({
          lead,
          campaignId: job.campaign_id,
          coachId: job.coach_id,
          nextPosition: (step.position as number) + 1,
          patch: { status: "in_sequence" },
        });
      } else if (step.step_type === "instagram" || step.step_type === "messenger") {
        const { text } = await renderedStepBody();
        const sent = await sendCampaignChannelMessage({
          coachId: job.coach_id,
          channel: step.step_type,
          lead: {
            id: lead.id as string,
            contact_id: (lead.contact_id as string | null) ?? null,
            unipile_chat_id: (lead.unipile_chat_id as string | null) ?? null,
            metadata: (lead.metadata || {}) as Record<string, unknown>,
          },
          text,
        });
        providerRef = sent.messageId;
        await advanceLeadAfterStep({
          lead,
          campaignId: job.campaign_id,
          coachId: job.coach_id,
          nextPosition: (step.position as number) + 1,
          patch: { status: "in_sequence" },
        });
      } else if (
        step.step_type === "instagram_react" ||
        step.step_type === "instagram_comment"
      ) {
        const { text } =
          step.step_type === "instagram_comment"
            ? await renderedStepBody()
            : { text: "" };
        providerRef = await engageInstagramLatestPost({
          coachId: job.coach_id,
          lead: {
            id: lead.id as string,
            contact_id: (lead.contact_id as string | null) ?? null,
            metadata: (lead.metadata || {}) as Record<string, unknown>,
          },
          mode: step.step_type === "instagram_react" ? "react" : "comment",
          text,
        });
        await advanceLeadAfterStep({
          lead,
          campaignId: job.campaign_id,
          coachId: job.coach_id,
          nextPosition: (step.position as number) + 1,
          patch: { status: "in_sequence" },
        });
      } else if (step.step_type === "instagram_follow") {
        providerRef = await followInstagramUser({
          coachId: job.coach_id,
          lead: {
            id: lead.id as string,
            contact_id: (lead.contact_id as string | null) ?? null,
            metadata: (lead.metadata || {}) as Record<string, unknown>,
          },
        });
        await advanceLeadAfterStep({
          lead,
          campaignId: job.campaign_id,
          coachId: job.coach_id,
          nextPosition: (step.position as number) + 1,
          patch: { status: "in_sequence" },
        });
      } else if (step.step_type === "email") {
        const { text } = await renderedStepBody();
        try {
          providerRef = await sendCampaignEmail({
            coachId: job.coach_id,
            lead: {
              id: lead.id as string,
              contact_id: (lead.contact_id as string | null) ?? null,
              first_name: (lead.first_name as string | null) ?? null,
              last_name: (lead.last_name as string | null) ?? null,
            },
            packedBody: text,
          });
        } catch (err) {
          if (!isMissingChannelContactError(err)) throw err;
          await advanceLeadAfterStep({
            lead,
            campaignId: job.campaign_id,
            coachId: job.coach_id,
            nextPosition: (step.position as number) + 1,
            patch: { status: "in_sequence" },
          });
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({
              status: "succeeded",
              provider_ref: null,
              sent_by: "worker",
              last_error: "Skipped: no email on this lead.",
            })
            .eq("id", job.id);
          succeeded += 1;
          return;
        }
        await advanceLeadAfterStep({
          lead,
          campaignId: job.campaign_id,
          coachId: job.coach_id,
          nextPosition: (step.position as number) + 1,
          patch: { status: "in_sequence" },
        });
      } else if (step.step_type === "whatsapp") {
        const { text } = await renderedStepBody();
        try {
          const sent = await sendCampaignWhatsApp({
            coachId: job.coach_id,
            lead: {
              id: lead.id as string,
              contact_id: (lead.contact_id as string | null) ?? null,
              unipile_chat_id: (lead.unipile_chat_id as string | null) ?? null,
              metadata: (lead.metadata || {}) as Record<string, unknown>,
            },
            text,
          });
          providerRef = sent.messageId;
        } catch (err) {
          if (!isMissingChannelContactError(err)) throw err;
          await advanceLeadAfterStep({
            lead,
            campaignId: job.campaign_id,
            coachId: job.coach_id,
            nextPosition: (step.position as number) + 1,
            patch: { status: "in_sequence" },
          });
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({
              status: "succeeded",
              provider_ref: null,
              sent_by: "worker",
              last_error: "Skipped: no phone on this lead.",
            })
            .eq("id", job.id);
          succeeded += 1;
          return;
        }
        await advanceLeadAfterStep({
          lead,
          campaignId: job.campaign_id,
          coachId: job.coach_id,
          nextPosition: (step.position as number) + 1,
          patch: { status: "in_sequence" },
        });
      } else if (step.step_type === "comment" || step.step_type === "react") {
        const meta = (lead.metadata || {}) as Record<string, unknown>;
        const pub =
          (meta.public_identifier as string | undefined) ||
          (lead.linkedin_url
            ? linkedInPublicIdentifier(lead.linkedin_url as string)
            : null) ||
          providerId;
        if (!pub) throw new Error("No profile identifier for engagement.");
        const posts = await listUnipileUserPosts({
          identifier: String(pub),
          account_id: accountId,
          limit: 5,
        });
        if (!posts.ok) throw new Error(posts.error || "Could not list posts.");
        const first = (posts.data?.items ?? [])[0] as
          | Record<string, unknown>
          | undefined;
        const socialId =
          (first?.social_id as string | undefined) ||
          (first?.id as string | undefined);
        if (!socialId) {
          throw new Error("Lead has no recent posts to engage with.");
        }
        if (step.step_type === "react") {
          const res = await reactUnipilePost({
            account_id: accountId,
            post_id: socialId,
            reaction_type: "like",
          });
          if (!res.ok) throw new Error(res.error || "React failed");
          providerRef = socialId;
        } else {
          const { text } = await renderedStepBody();
          if (!text.trim()) throw new Error("Empty comment body.");
          const res = await commentUnipilePost({
            post_id: String(first?.id || socialId),
            account_id: accountId,
            text,
          });
          if (!res.ok) throw new Error(res.error || "Comment failed");
          providerRef = res.data?.comment_id ?? socialId;
        }
        await advanceLeadAfterStep({
          lead,
          campaignId: job.campaign_id,
          coachId: job.coach_id,
          nextPosition: (step.position as number) + 1,
          patch: { status: "in_sequence" },
        });
      } else if (
        step.step_type === "notify" ||
        step.step_type === "add_to_campaign"
      ) {
        await advanceLeadAfterStep({
          lead,
          campaignId: job.campaign_id,
          coachId: job.coach_id,
          nextPosition: (step.position as number) + 1,
          patch: { status: "in_sequence" },
        });
      } else if (step.step_type === "call") {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({
            status: "awaiting_coach",
            last_error: null,
          })
          .eq("id", job.id);
        return;
      } else {
        throw new Error(`Unsupported step type ${step.step_type}`);
      }

      // Space out next actions for this account (one outbound at a time).
      try {
        await recordSuccessfulOutreachSend({
          coachId: job.coach_id,
          jobId: job.id,
          outreachAccountId:
            (campaign.outreach_account_id as string | null) ?? null,
          sendAccount,
          kind: sendKind,
          delaySeed: String(job.id),
          fallbackDelaySeconds:
            (campaign.min_action_delay_seconds as number) || 180,
        });
      } catch {
        /* LinkedIn already sent — do not fail the job on bookkeeping. */
      }

      await supabaseAdmin
        .from("linkedin_send_jobs")
        .update({
          status: "succeeded",
          provider_ref: providerRef,
          sent_by: "worker",
          last_error: null,
        })
        .eq("id", job.id);
      succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Job failed";
      errors.push(message);

      // Circuit breakers — do not burn the account on LinkedIn throttles.
      try {
        const { data: camp } = await supabaseAdmin
          .from("linkedin_campaigns")
          .select("outreach_account_id")
          .eq("id", job.campaign_id)
          .maybeSingle();
        const accId = camp?.outreach_account_id as string | null;
        const { data: jobStep } = await supabaseAdmin
          .from("linkedin_campaign_steps")
          .select("step_type")
          .eq("id", job.step_id)
          .maybeSingle();
        const jobStepType = String(jobStep?.step_type || "");

        // The whole campaign's note is too long: failing lead after lead would
        // use up the list. Pause the campaign, keep the lead, tell BCA once.
        if (jobStepType === "invite" && isNoteTooLong(err)) {
          const { data: paused } = await supabaseAdmin
            .from("linkedin_campaigns")
            .update({ status: "paused" })
            .eq("id", job.campaign_id)
            .eq("status", "running")
            .select("name")
            .maybeSingle();
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({
              status: "cancelled",
              last_error: "Connection note too long for this LinkedIn account; campaign paused.",
            })
            .eq("id", job.id);
          if (paused) {
            const { cancelOpenSendJobsForCampaign } = await import("@/lib/unipile/remindQueue");
            await cancelOpenSendJobsForCampaign(
              String(job.coach_id),
              String(job.campaign_id),
              "Campaign paused: connection note too long"
            );
            const names = await coachNames([String(job.coach_id)]);
            await raiseOutreachAlert({
              title: `Sales Robot: ${names.get(String(job.coach_id)) ?? "A coach"}'s connection note is too long`,
              details: `LinkedIn refused the connection note in "${paused.name ?? "a campaign"}" as too long, so the campaign is paused and no one was marked failed. Free LinkedIn accounts allow 200 characters (Premium allows 300), counted after names are filled in. Shorten the note, then start the campaign again.`,
            });
          }
          return;
        }

        // LinkedIn's account-wide limit: hold the sends, don't fail the people.
        if (accId && isProviderLimit(err)) {
          const until = new Date(
            Date.now() + (jobStepType === "invite" ? 24 : 2) * 3600 * 1000
          );
          if (jobStepType === "invite") {
            await pauseInvitesUntil(accId, until, "provider_limit");
          } else {
            await setRateLimitedUntil(accId, until);
          }
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({
              status: "pending",
              scheduled_for: until.toISOString(),
              last_error: "LinkedIn limit reached; trying again later.",
            })
            .eq("id", job.id);
          return;
        }

        // Their Open Profile message went out; LinkedIn allows nothing more
        // until they answer. That's the end of the sequence, not a failure.
        if (isInmailNotAccepted(err)) {
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({ status: "cancelled", last_error: message })
            .eq("id", job.id);
          await supabaseAdmin
            .from("linkedin_campaign_leads")
            .update({
              status: "completed",
              next_action_at: null,
              last_error: "Open Profile message sent. LinkedIn allows no more until they reply.",
            })
            .eq("id", job.lead_id)
            .not("status", "in", "(replied,interested,call_offered,assessment_sent,assessment_done)");
          return;
        }

        if (accId && isCannotResendYet(err)) {
          const until = new Date(Date.now() + 24 * 3600 * 1000);
          await pauseInvitesUntil(accId, until, "cannot_resend_yet");
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({
              status: "pending",
              scheduled_for: until.toISOString(),
              last_error: "LinkedIn invite limit; paused 24h.",
            })
            .eq("id", job.id);
          return;
        }
        if (accId && isHttp429(err)) {
          const until = new Date(
            Date.now() + (30 + jitterSeconds(0, 90)) * 60 * 1000
          );
          await setRateLimitedUntil(accId, until);
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({
              status: "pending",
              scheduled_for: until.toISOString(),
              last_error: "Rate limited; backing off.",
            })
            .eq("id", job.id);
          return;
        }
      } catch {
        /* fall through to fail the job */
      }

      failed += 1;
      await supabaseAdmin
        .from("linkedin_send_jobs")
        .update({ status: "failed", last_error: message })
        .eq("id", job.id);
      await supabaseAdmin
        .from("linkedin_campaign_leads")
        .update({ status: "failed", last_error: message })
        .eq("id", job.lead_id);
    }
  }));

  if (!only) {
    await alertStuckCampaigns(
      candidates,
      new Set(jobs.map((j) => String(j.id)))
    );
  }

  return {
    processed: processed + fallback.processed,
    succeeded: succeeded + fallback.succeeded,
    failed: failed + fallback.failed,
    errors: [...fallback.errors, ...errors],
  };
}

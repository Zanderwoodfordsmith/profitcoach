import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  preferLinkedInUrl,
} from "@/lib/contacts/linkedinIdentity";
import {
  resolveUnipileUser,
  sendUnipileInvitation,
  commentUnipilePost,
  reactUnipilePost,
  listUnipileUserPosts,
} from "@/lib/unipile/client";
import { buildMessageBody } from "@/lib/unipile/campaigns";
import { consumeNonOutboundSteps, processExpiredInviteTimeouts } from "@/lib/unipile/sequenceAdvance";
import { sendCampaignLinkedInMessage } from "@/lib/unipile/campaignLinkedInSend";
import {
  campaignStepCreatesJob,
  inviteNoConnectFrom,
  isLinkedInOutreachStep,
  messageSendConfigFrom,
} from "@/lib/unipile/campaignStepTypes";
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
  pauseInvitesUntil,
  setRateLimitedUntil,
  type AccountSendSettings,
} from "@/lib/unipile/accountSendPlan";
import {
  checkOutreachSendSafety,
  jitterSeconds,
  recordSuccessfulOutreachSend,
  sendKindFromStepType,
} from "@/lib/unipile/outreachSendSafety";

/** Global jobs claimed per cron tick (across coaches). */
const MAX_JOBS_PER_TICK = 8;
/** Lookahead so we can pick one job per LinkedIn account. */
const CANDIDATE_JOBS_PER_TICK = 48;

function isCannotResendYet(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /cannot_resend_yet|422/i.test(message);
}

function isHttp429(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /too many requests|\b429\b/i.test(message);
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
    const accountKey =
      (campaign.outreach_account_id as string | null) ||
      `coach:${String(job.coach_id)}`;
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
  accountId: string
): Promise<{
  providerId: string | null;
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

  if (!needsProfile) {
    return { providerId: lead.linkedin_provider_id, lead: enriched };
  }

  const pub =
    (lead.metadata?.public_identifier as string | undefined) ||
    (lead.linkedin_url ? linkedInPublicIdentifier(lead.linkedin_url) : null);

  if (!pub && !lead.linkedin_provider_id) {
    return { providerId: null, lead: enriched };
  }

  const identifier = pub || lead.linkedin_provider_id!;
  const resolved = await resolveUnipileUser(identifier, accountId);
  if (!resolved.ok || !resolved.data) {
    return { providerId: lead.linkedin_provider_id, lead: enriched };
  }

  const data = resolved.data as Record<string, unknown>;
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
        },
      })
      .eq("id", lead.id);
  }

  return { providerId, lead: enriched };
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

export async function processOutreachJobsTick(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const { processRemindFallbacks } = await import("@/lib/unipile/remindQueue");
  const fallback = await processRemindFallbacks();
  await processExpiredInviteTimeouts();

  const now = new Date().toISOString();
  const { data: candidates, error } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(CANDIDATE_JOBS_PER_TICK);

  if (error) throw new Error(error.message);

  const jobs = await pickJobsOnePerAccount(
    (candidates ?? []) as Array<Record<string, unknown>>
  );

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const rawJob of jobs) {
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
    if (!claim.data) continue;

    try {
      const { data: campaign } = await supabaseAdmin
        .from("linkedin_campaigns")
        .select(
          "*, linkedin_outreach_accounts(id, unipile_account_id, status, timezone, send_rules, weekly_invite_target, daily_message_target, daily_react_target, min_action_delay_seconds, max_action_delay_seconds, warmup_started_at, invite_paused_until, rate_limited_until, daily_send_plan, ssi_score, coach_id)"
        )
        .eq("id", job.campaign_id)
        .maybeSingle();

      if (!campaign || campaign.status !== "running") {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({ status: "cancelled", last_error: "Campaign not running" })
          .eq("id", job.id);
        continue;
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
        continue;
      }

      if ((campaign.channel as string | undefined) === "email") {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({
            status: "cancelled",
            last_error: "Email campaigns are not sent automatically yet.",
          })
          .eq("id", job.id);
        continue;
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

      const stepType = step.step_type as string;
      const sendKind = sendKindFromStepType(stepType);

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
      if (!safety.result.ok) {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({
            status: "pending",
            scheduled_for: safety.result.deferUntil.toISOString(),
            last_error: safety.result.reason,
          })
          .eq("id", job.id);
        continue;
      }

      const linkedInAccountId = sendAccount?.unipile_account_id;
      const needsLinkedIn = isLinkedInOutreachStep(stepType);
      if (
        needsLinkedIn &&
        (!linkedInAccountId || sendAccount?.status === "CREDENTIALS")
      ) {
        throw new Error("LinkedIn account missing or disconnected.");
      }
      const accountId = linkedInAccountId ?? "";

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
        continue;
      }

      let providerId: string | null = lead.linkedin_provider_id as string | null;
      let leadForMessage = lead;
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
          accountId
        );
        providerId = resolved.providerId;
        if (!providerId) throw new Error("Could not resolve LinkedIn provider id.");
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
      const templateExtras = {
        assessment_url: assessmentUrl,
        scorecard_url: assessmentUrl,
        scorecard_link: assessmentUrl,
        assessment_pro_url: assessmentProUrl,
        coach_name: coachName,
        review_name: "Business Clarity Review",
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
        return {
          text: buildMessageBody(picked.body, leadForMessage, templateExtras),
          variantKey: picked.variantKey,
          variant: picked.variant,
        };
      }

      let providerRef: string | null = null;

      if (step.step_type === "invite") {
        const { text: note } = await renderedStepBody();
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
            continue;
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
            next_action_at: timeoutAt,
            last_error: null,
          })
          .eq("id", lead.id);
      } else if (step.step_type === "message") {
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
          continue;
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
          continue;
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
        continue;
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
          continue;
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
          continue;
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
  }

  return {
    processed: processed + fallback.processed,
    succeeded: succeeded + fallback.succeeded,
    failed: failed + fallback.failed,
    errors: [...fallback.errors, ...errors],
  };
}

/**
 * Coach-send ("remind") campaign steps: due queue, manual send/skip/snooze, fallback auto.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  sendUnipileChatMessage,
  startUnipileChat,
} from "@/lib/unipile/client";
import { buildMessageBody } from "@/lib/unipile/campaigns";
import { advanceLeadAfterStep } from "@/lib/unipile/worker";
import {
  resolveStepBodyForLead,
  buildLeadAssessmentUrl,
} from "@/lib/unipile/interest";

export type RemindQueueItem = {
  job_id: string;
  campaign_id: string;
  campaign_name: string;
  lead_id: string;
  step_id: string;
  step_position: number;
  scheduled_for: string;
  draft_body: string | null;
  preview_body: string;
  fallback_hours: number | null;
  fallback_at: string | null;
  state: "upcoming" | "due" | "overdue";
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  linkedin_url: string | null;
  contact_id: string | null;
};

function jobStatusForStep(sendMode: string | null | undefined): "pending" | "awaiting_coach" {
  return sendMode === "remind" ? "awaiting_coach" : "pending";
}

export { jobStatusForStep };

export async function cancelOpenSendJobs(leadId: string, reason: string) {
  await supabaseAdmin
    .from("linkedin_send_jobs")
    .update({ status: "cancelled", last_error: reason })
    .eq("lead_id", leadId)
    .in("status", ["pending", "awaiting_coach", "running"]);
}

export async function cancelOpenSendJobsForCampaign(
  coachId: string,
  campaignId: string,
  reason: string
) {
  await supabaseAdmin
    .from("linkedin_send_jobs")
    .update({ status: "cancelled", last_error: reason })
    .eq("coach_id", coachId)
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "awaiting_coach"]);
}

async function renderPreviewForJob(input: {
  coachId: string;
  lead: Record<string, unknown>;
  step: Record<string, unknown>;
  draftBody?: string | null;
  useFallback?: boolean;
}): Promise<string> {
  const { data: coachRow } = await supabaseAdmin
    .from("profiles")
    .select("full_name, first_name")
    .eq("id", input.coachId)
    .maybeSingle();
  const coachName =
    (coachRow?.full_name as string) ||
    (coachRow?.first_name as string) ||
    "";
  const assessmentUrl = await buildLeadAssessmentUrl({
    coachId: input.coachId,
    firstName: input.lead.first_name as string | null,
    lastName: input.lead.last_name as string | null,
    company: input.lead.company as string | null,
  });
  const extras = {
    assessment_url: assessmentUrl,
    scorecard_url: assessmentUrl,
    coach_name: coachName,
    review_name: "Business Clarity Review",
  };

  if (input.draftBody?.trim()) {
    return buildMessageBody(input.draftBody, input.lead as never, extras);
  }

  const template = input.useFallback
    ? ((input.step.fallback_body as string) ||
        (input.step.body as string) ||
        "")
    : ((input.step.body as string) || "");

  if (input.useFallback) {
    return buildMessageBody(template, input.lead as never, extras);
  }

  const picked = await resolveStepBodyForLead({
    leadId: input.lead.id as string,
    stepId: input.step.id as string,
    body: template,
    variants: input.step.variants,
    abAssignments: input.lead.ab_assignments,
  });
  return buildMessageBody(picked.body, input.lead as never, extras);
}

function classifyState(
  scheduledFor: string,
  now = Date.now()
): "upcoming" | "due" | "overdue" {
  const dueAt = new Date(scheduledFor).getTime();
  if (dueAt > now) return "upcoming";
  const overdueAfterMs = 24 * 3600 * 1000;
  if (now - dueAt >= overdueAfterMs) return "overdue";
  return "due";
}

export async function countRemindDue(coachId: string): Promise<{
  due: number;
  overdue: number;
  upcoming: number;
}> {
  const { data: jobs } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("id, scheduled_for, campaign_id")
    .eq("coach_id", coachId)
    .eq("status", "awaiting_coach");

  if (!jobs?.length) return { due: 0, overdue: 0, upcoming: 0 };

  const campaignIds = [...new Set(jobs.map((j) => j.campaign_id as string))];
  const { data: campaigns } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, status")
    .in("id", campaignIds)
    .eq("coach_id", coachId);

  const running = new Set(
    (campaigns ?? [])
      .filter((c) => c.status === "running")
      .map((c) => c.id as string)
  );

  let due = 0;
  let overdue = 0;
  let upcoming = 0;
  for (const job of jobs) {
    if (!running.has(job.campaign_id as string)) continue;
    const state = classifyState(job.scheduled_for as string);
    if (state === "upcoming") upcoming += 1;
    else if (state === "overdue") overdue += 1;
    else due += 1;
  }
  return { due, overdue, upcoming };
}

export async function listRemindQueue(
  coachId: string,
  opts?: { includeUpcoming?: boolean }
): Promise<RemindQueueItem[]> {
  const includeUpcoming = opts?.includeUpcoming !== false;
  const { data: jobs, error } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select(
      "id, campaign_id, lead_id, step_id, scheduled_for, draft_body, coach_id"
    )
    .eq("coach_id", coachId)
    .eq("status", "awaiting_coach")
    .order("scheduled_for", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  if (!jobs?.length) return [];

  const campaignIds = [...new Set(jobs.map((j) => j.campaign_id as string))];
  const leadIds = [...new Set(jobs.map((j) => j.lead_id as string))];
  const stepIds = [...new Set(jobs.map((j) => j.step_id as string))];

  const [{ data: campaigns }, { data: leads }, { data: steps }] =
    await Promise.all([
      supabaseAdmin
        .from("linkedin_campaigns")
        .select("id, name, status")
        .in("id", campaignIds)
        .eq("coach_id", coachId),
      supabaseAdmin
        .from("linkedin_campaign_leads")
        .select(
          "id, first_name, last_name, company, linkedin_url, contact_id, ab_assignments"
        )
        .in("id", leadIds),
      supabaseAdmin
        .from("linkedin_campaign_steps")
        .select(
          "id, position, body, fallback_body, fallback_hours, variants, send_mode"
        )
        .in("id", stepIds),
    ]);

  const campaignById = new Map((campaigns ?? []).map((c) => [c.id as string, c]));
  const leadById = new Map((leads ?? []).map((l) => [l.id as string, l]));
  const stepById = new Map((steps ?? []).map((s) => [s.id as string, s]));

  const items: RemindQueueItem[] = [];
  for (const job of jobs) {
    const campaign = campaignById.get(job.campaign_id as string);
    const lead = leadById.get(job.lead_id as string);
    const step = stepById.get(job.step_id as string);
    if (!campaign || campaign.status !== "running" || !lead || !step) continue;

    const state = classifyState(job.scheduled_for as string);
    if (!includeUpcoming && state === "upcoming") continue;

    const fallbackHours =
      step.fallback_hours != null ? Number(step.fallback_hours) : null;
    const fallbackAt =
      fallbackHours != null && Number.isFinite(fallbackHours)
        ? new Date(
            new Date(job.scheduled_for as string).getTime() +
              fallbackHours * 3600 * 1000
          ).toISOString()
        : null;

    const preview = await renderPreviewForJob({
      coachId,
      lead: lead as Record<string, unknown>,
      step: step as Record<string, unknown>,
      draftBody: job.draft_body as string | null,
    });

    items.push({
      job_id: job.id as string,
      campaign_id: job.campaign_id as string,
      campaign_name: (campaign.name as string) || "Campaign",
      lead_id: job.lead_id as string,
      step_id: job.step_id as string,
      step_position: Number(step.position ?? 0),
      scheduled_for: job.scheduled_for as string,
      draft_body: (job.draft_body as string | null) ?? null,
      preview_body: preview,
      fallback_hours: fallbackHours,
      fallback_at: fallbackAt,
      state,
      first_name: (lead.first_name as string | null) ?? null,
      last_name: (lead.last_name as string | null) ?? null,
      company: (lead.company as string | null) ?? null,
      linkedin_url: (lead.linkedin_url as string | null) ?? null,
      contact_id: (lead.contact_id as string | null) ?? null,
    });
  }

  return items;
}

async function loadAwaitingJob(coachId: string, jobId: string) {
  const { data: job, error } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("coach_id", coachId)
    .eq("status", "awaiting_coach")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) throw new Error("Remind job not found or already handled.");

  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("*, linkedin_outreach_accounts(unipile_account_id, status)")
    .eq("id", job.campaign_id)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!campaign || campaign.status !== "running") {
    throw new Error("Campaign is not running.");
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

  return { job, campaign, step, lead };
}

async function sendLinkedInMessageForLead(input: {
  accountId: string;
  providerId: string;
  lead: Record<string, unknown>;
  text: string;
}): Promise<{ chatId: string | null; messageId: string | null }> {
  let chatId = (input.lead.unipile_chat_id as string | null) ?? null;
  if (chatId) {
    const res = await sendUnipileChatMessage({
      chat_id: chatId,
      text: input.text,
    });
    if (!res.ok) throw new Error(res.error || "Send message failed");
    return { chatId, messageId: res.data?.message_id ?? null };
  }
  const res = await startUnipileChat({
    account_id: input.accountId,
    attendees_ids: [input.providerId],
    text: input.text,
  });
  if (!res.ok) throw new Error(res.error || "Start chat failed");
  chatId = res.data?.chat_id ?? null;
  if (chatId) {
    await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({ unipile_chat_id: chatId })
      .eq("id", input.lead.id);
  }
  return { chatId, messageId: res.data?.message_id ?? null };
}

async function resolveAccountAndProvider(input: {
  campaign: Record<string, unknown>;
  lead: Record<string, unknown>;
}) {
  const accountRel = input.campaign.linkedin_outreach_accounts as
    | { unipile_account_id?: string; status?: string }
    | { unipile_account_id?: string; status?: string }[]
    | null;
  const account = Array.isArray(accountRel) ? accountRel[0] : accountRel;
  const accountId = account?.unipile_account_id;
  if (!accountId || account?.status === "CREDENTIALS") {
    throw new Error("LinkedIn account missing or disconnected.");
  }

  let providerId = input.lead.linkedin_provider_id as string | null;
  if (!providerId) {
    const { resolveUnipileUser } = await import("@/lib/unipile/client");
    const { linkedInPublicIdentifier } = await import(
      "@/lib/unipile/linkedinUrl"
    );
    const meta = (input.lead.metadata || {}) as Record<string, unknown>;
    const pub =
      (meta.public_identifier as string | undefined) ||
      (input.lead.linkedin_url
        ? linkedInPublicIdentifier(input.lead.linkedin_url as string)
        : null);
    if (!pub) throw new Error("Could not resolve LinkedIn provider id.");
    const resolved = await resolveUnipileUser(pub, accountId);
    if (!resolved.ok || !resolved.data) {
      throw new Error("Could not resolve LinkedIn provider id.");
    }
    const data = resolved.data as Record<string, unknown>;
    providerId =
      (data.provider_id as string | undefined) ||
      (data.id as string | undefined) ||
      null;
    if (!providerId) throw new Error("Could not resolve LinkedIn provider id.");
    await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({ linkedin_provider_id: providerId })
      .eq("id", input.lead.id);
  }

  return { accountId, providerId };
}

/** Coach sends (optional edited body) and advances the lead. */
export async function sendRemindJob(input: {
  coachId: string;
  jobId: string;
  body?: string | null;
}) {
  const { job, campaign, step, lead } = await loadAwaitingJob(
    input.coachId,
    input.jobId
  );
  if (step.step_type !== "message") {
    throw new Error("Only message steps can be coach-sent.");
  }

  const { data: claimed } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .update({ status: "running", attempts: (job.attempts ?? 0) + 1 })
    .eq("id", job.id)
    .eq("status", "awaiting_coach")
    .select("id")
    .maybeSingle();
  if (!claimed) throw new Error("Remind job not found or already handled.");

  try {
    const text = await renderPreviewForJob({
      coachId: input.coachId,
      lead: lead as Record<string, unknown>,
      step: step as Record<string, unknown>,
      draftBody: input.body ?? (job.draft_body as string | null),
    });
    if (!text.trim()) throw new Error("Empty message body.");

    const { accountId, providerId } = await resolveAccountAndProvider({
      campaign: campaign as Record<string, unknown>,
      lead: lead as Record<string, unknown>,
    });

    const sent = await sendLinkedInMessageForLead({
      accountId,
      providerId,
      lead: lead as Record<string, unknown>,
      text,
    });

    await advanceLeadAfterStep({
      lead,
      campaignId: job.campaign_id as string,
      coachId: input.coachId,
      nextPosition: (step.position as number) + 1,
      patch: { status: "in_sequence" },
    });

    await supabaseAdmin
      .from("linkedin_send_jobs")
      .update({
        status: "succeeded",
        provider_ref: sent.messageId,
        draft_body: input.body ?? job.draft_body,
        sent_by: "coach",
        last_error: null,
      })
      .eq("id", job.id);

    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await supabaseAdmin
      .from("linkedin_send_jobs")
      .update({
        status: "awaiting_coach",
        last_error: message,
      })
      .eq("id", job.id);
    throw err;
  }
}

export async function skipRemindJob(input: {
  coachId: string;
  jobId: string;
}) {
  const { job, step, lead } = await loadAwaitingJob(input.coachId, input.jobId);

  await supabaseAdmin
    .from("linkedin_send_jobs")
    .update({
      status: "cancelled",
      last_error: "Skipped by coach",
      sent_by: null,
    })
    .eq("id", job.id)
    .eq("status", "awaiting_coach");

  await advanceLeadAfterStep({
    lead,
    campaignId: job.campaign_id as string,
    coachId: input.coachId,
    nextPosition: (step.position as number) + 1,
    patch: { status: "in_sequence" },
  });

  return { ok: true as const };
}

export async function snoozeRemindJob(input: {
  coachId: string;
  jobId: string;
  hours?: number;
  draftBody?: string | null;
}) {
  const { job } = await loadAwaitingJob(input.coachId, input.jobId);
  const hours = Math.max(1, Math.min(168, Number(input.hours ?? 24)));
  const scheduled = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const patch: Record<string, unknown> = {
    scheduled_for: scheduled,
    last_error: null,
  };
  if (input.draftBody !== undefined) {
    patch.draft_body = input.draftBody;
  }
  const { error } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .update(patch)
    .eq("id", job.id)
    .eq("status", "awaiting_coach");
  if (error) throw new Error(error.message);
  return { ok: true as const, scheduled_for: scheduled };
}

export async function saveRemindDraft(input: {
  coachId: string;
  jobId: string;
  draftBody: string;
}) {
  const { job } = await loadAwaitingJob(input.coachId, input.jobId);
  const { error } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .update({ draft_body: input.draftBody.slice(0, 8000) })
    .eq("id", job.id)
    .eq("status", "awaiting_coach");
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** Auto-send fallback for remind jobs past their fallback window. */
export async function processRemindFallbacks(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const now = Date.now();
  const { data: jobs, error } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("*")
    .eq("status", "awaiting_coach")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const job of jobs ?? []) {
    const { data: step } = await supabaseAdmin
      .from("linkedin_campaign_steps")
      .select("*")
      .eq("id", job.step_id)
      .maybeSingle();
    if (!step || step.send_mode !== "remind") continue;
    if (step.fallback_hours == null) continue;
    const fallbackHours = Number(step.fallback_hours);
    if (!Number.isFinite(fallbackHours) || fallbackHours <= 0) continue;

    const dueAt = new Date(job.scheduled_for as string).getTime();
    const fallbackAt = dueAt + fallbackHours * 3600 * 1000;
    if (now < fallbackAt) continue;

    processed += 1;
    const { data: claimed } = await supabaseAdmin
      .from("linkedin_send_jobs")
      .update({ status: "running", attempts: (job.attempts ?? 0) + 1 })
      .eq("id", job.id)
      .eq("status", "awaiting_coach")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const { data: campaign } = await supabaseAdmin
        .from("linkedin_campaigns")
        .select("*, linkedin_outreach_accounts(unipile_account_id, status)")
        .eq("id", job.campaign_id)
        .maybeSingle();
      if (!campaign || campaign.status !== "running") {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({
            status: "cancelled",
            last_error: "Campaign not running",
          })
          .eq("id", job.id);
        continue;
      }

      const { data: lead } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("*")
        .eq("id", job.lead_id)
        .maybeSingle();
      if (!lead) throw new Error("Lead missing.");

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

      if (step.step_type !== "message") {
        throw new Error("Fallback only supported for message steps.");
      }

      const text = await renderPreviewForJob({
        coachId: job.coach_id as string,
        lead: lead as Record<string, unknown>,
        step: step as Record<string, unknown>,
        useFallback: true,
      });
      if (!text.trim()) throw new Error("Empty fallback body.");

      const { accountId, providerId } = await resolveAccountAndProvider({
        campaign: campaign as Record<string, unknown>,
        lead: lead as Record<string, unknown>,
      });

      const sent = await sendLinkedInMessageForLead({
        accountId,
        providerId,
        lead: lead as Record<string, unknown>,
        text,
      });

      await advanceLeadAfterStep({
        lead,
        campaignId: job.campaign_id as string,
        coachId: job.coach_id as string,
        nextPosition: (step.position as number) + 1,
        patch: { status: "in_sequence" },
      });

      await supabaseAdmin
        .from("linkedin_send_jobs")
        .update({
          status: "succeeded",
          provider_ref: sent.messageId,
          sent_by: "fallback",
          last_error: null,
        })
        .eq("id", job.id);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "Fallback failed";
      errors.push(message);
      await supabaseAdmin
        .from("linkedin_send_jobs")
        .update({
          status: "awaiting_coach",
          last_error: `Fallback failed: ${message}`,
        })
        .eq("id", job.id);
    }
  }

  return { processed, succeeded, failed, errors };
}

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  resolveUnipileUser,
  sendUnipileChatMessage,
  sendUnipileInvitation,
  startUnipileChat,
  commentUnipilePost,
  reactUnipilePost,
  listUnipileUserPosts,
} from "@/lib/unipile/client";
import { buildMessageBody } from "@/lib/unipile/campaigns";
import { linkedInPublicIdentifier } from "@/lib/unipile/linkedinUrl";
import {
  extractUnipileProfileFields,
  leadFieldsIncomplete,
  mergeLeadFields,
  type OutreachLeadFields,
} from "@/lib/unipile/profileVars";

const MAX_JOBS_PER_TICK = 8;

function jitterSeconds(min: number, max: number) {
  return min + Math.floor(Math.random() * Math.max(1, max - min + 1));
}

async function countInvitesToday(coachId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data: jobs } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("id, step_id")
    .eq("coach_id", coachId)
    .eq("status", "succeeded")
    .gte("updated_at", start.toISOString());
  if (!jobs?.length) return 0;
  const stepIds = [...new Set(jobs.map((j) => j.step_id as string))];
  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("id, step_type")
    .in("id", stepIds);
  const inviteSteps = new Set(
    (steps ?? [])
      .filter((s) => s.step_type === "invite")
      .map((s) => s.id as string)
  );
  return jobs.filter((j) => inviteSteps.has(j.step_id as string)).length;
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
    !lead.linkedin_provider_id || leadFieldsIncomplete(enriched);

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
    await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({
        linkedin_provider_id: providerId,
        first_name: enriched.first_name,
        last_name: enriched.last_name,
        company: enriched.company,
        title: enriched.title,
        metadata: {
          ...((lead.metadata as Record<string, unknown>) || {}),
          city: enriched.city,
          location: enriched.location,
          public_identifier:
            (data.public_identifier as string | undefined) ||
            (lead.metadata?.public_identifier as string | undefined) ||
            pub,
        },
      })
      .eq("id", lead.id);
  }

  return { providerId, lead: enriched };
}

async function advanceLeadAfterStep(input: {
  lead: Record<string, unknown>;
  campaignId: string;
  coachId: string;
  nextPosition: number;
  patch?: Record<string, unknown>;
}) {
  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("*")
    .eq("campaign_id", input.campaignId)
    .order("position", { ascending: true });

  let pos = input.nextPosition;
  let nextAction = new Date();
  let status = "in_sequence";

  // Consume wait steps immediately by scheduling
  while (true) {
    const step = (steps ?? []).find((s) => s.position === pos);
    if (!step) {
      status = "completed";
      break;
    }
    if (step.step_type === "wait") {
      const hours = Number(step.wait_hours ?? 24);
      nextAction = new Date(Date.now() + hours * 3600 * 1000);
      pos += 1;
      continue;
    }
    break;
  }

  const finalStep = (steps ?? []).find((s) => s.position === pos);
  if (!finalStep && status !== "completed") status = "completed";

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

  if (status !== "completed" && finalStep && finalStep.step_type !== "wait") {
    await supabaseAdmin.from("linkedin_send_jobs").insert({
      coach_id: input.coachId,
      campaign_id: input.campaignId,
      lead_id: input.lead.id,
      step_id: finalStep.id,
      scheduled_for: nextAction.toISOString(),
      status: "pending",
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
  const now = new Date().toISOString();
  const { data: jobs, error } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(MAX_JOBS_PER_TICK);

  if (error) throw new Error(error.message);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const job of jobs ?? []) {
    processed += 1;
    await supabaseAdmin
      .from("linkedin_send_jobs")
      .update({ status: "running", attempts: (job.attempts ?? 0) + 1 })
      .eq("id", job.id)
      .eq("status", "pending");

    try {
      const { data: campaign } = await supabaseAdmin
        .from("linkedin_campaigns")
        .select("*, linkedin_outreach_accounts(unipile_account_id, status)")
        .eq("id", job.campaign_id)
        .maybeSingle();

      if (!campaign || campaign.status !== "running") {
        await supabaseAdmin
          .from("linkedin_send_jobs")
          .update({ status: "cancelled", last_error: "Campaign not running" })
          .eq("id", job.id);
        continue;
      }

      const accountRel = campaign.linkedin_outreach_accounts as
        | { unipile_account_id?: string; status?: string }
        | { unipile_account_id?: string; status?: string }[]
        | null;
      const account = Array.isArray(accountRel) ? accountRel[0] : accountRel;
      const accountId = account?.unipile_account_id;
      if (!accountId || account?.status === "CREDENTIALS") {
        throw new Error("LinkedIn account missing or disconnected.");
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
          .update({ status: "cancelled", last_error: `Lead status ${lead.status}` })
          .eq("id", job.id);
        continue;
      }

      // Volume: invites per day
      if (step.step_type === "invite") {
        const used = await countInvitesToday(job.coach_id);
        if (used >= (campaign.daily_invite_limit ?? 20)) {
          const tomorrow = new Date();
          tomorrow.setUTCHours(24, jitterSeconds(5, 30), 0, 0);
          await supabaseAdmin
            .from("linkedin_send_jobs")
            .update({
              status: "pending",
              scheduled_for: tomorrow.toISOString(),
              last_error: "Daily invite limit reached; deferred.",
            })
            .eq("id", job.id);
          continue;
        }
      }

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
      const providerId = resolved.providerId;
      if (!providerId) throw new Error("Could not resolve LinkedIn provider id.");
      const leadForMessage = { ...lead, ...resolved.lead };

      const { resolveStepBodyForLead, buildLeadAssessmentUrl } = await import(
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
        firstName: leadForMessage.first_name as string | null,
        lastName: leadForMessage.last_name as string | null,
        company: leadForMessage.company as string | null,
      });
      const templateExtras = {
        assessment_url: assessmentUrl,
        scorecard_url: assessmentUrl,
        coach_name: coachName,
        review_name: "Business Clarity Review",
      };

      async function renderedStepBody() {
        const picked = await resolveStepBodyForLead({
          leadId: lead.id as string,
          stepId: step.id as string,
          body: (step.body as string) || "",
          variants: step.variants,
          abAssignments: lead.ab_assignments,
        });
        return {
          text: buildMessageBody(picked.body, leadForMessage, templateExtras),
          variantKey: picked.variantKey,
        };
      }

      let providerRef: string | null = null;

      if (step.step_type === "invite") {
        const { text: note } = await renderedStepBody();
        const res = await sendUnipileInvitation({
          account_id: accountId,
          provider_id: providerId,
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
        // Stay on invite step until new_relation webhook (accept) advances.
        await supabaseAdmin
          .from("linkedin_campaign_leads")
          .update({
            status: "invited",
            invitation_id: providerRef,
            next_action_at: null,
            last_error: null,
          })
          .eq("id", lead.id);
      } else if (step.step_type === "message") {
        const { text, variantKey } = await renderedStepBody();
        if (!text.trim()) throw new Error("Empty message body.");
        // keep variantKey on job metadata via provider_ref suffix if needed
        void variantKey;
        let chatId = lead.unipile_chat_id as string | null;
        if (chatId) {
          const res = await sendUnipileChatMessage({ chat_id: chatId, text });
          if (!res.ok) throw new Error(res.error || "Send message failed");
          providerRef = res.data?.message_id ?? null;
        } else {
          const res = await startUnipileChat({
            account_id: accountId,
            attendees_ids: [providerId],
            text,
          });
          if (!res.ok) throw new Error(res.error || "Start chat failed");
          chatId = res.data?.chat_id ?? null;
          providerRef = res.data?.message_id ?? null;
          if (chatId) {
            await supabaseAdmin
              .from("linkedin_campaign_leads")
              .update({ unipile_chat_id: chatId })
              .eq("id", lead.id);
          }
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
      } else {
        throw new Error(`Unsupported step type ${step.step_type}`);
      }

      // Space out next actions for this account
      const delay = Math.max(
        60,
        (campaign.min_action_delay_seconds as number) || 180
      ) + jitterSeconds(0, 60);
      const deferUntil = new Date(Date.now() + delay * 1000).toISOString();
      await supabaseAdmin
        .from("linkedin_send_jobs")
        .update({
          status: "pending",
          scheduled_for: deferUntil,
        })
        .eq("coach_id", job.coach_id)
        .eq("status", "pending")
        .neq("id", job.id)
        .lt("scheduled_for", deferUntil);

      await supabaseAdmin
        .from("linkedin_send_jobs")
        .update({ status: "succeeded", provider_ref: providerRef, last_error: null })
        .eq("id", job.id);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "Job failed";
      errors.push(message);
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

  return { processed, succeeded, failed, errors };
}

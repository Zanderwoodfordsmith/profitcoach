import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  linkedInPublicIdentifier,
  normalizeLinkedInProfileUrl,
  renderOutreachTemplate,
} from "@/lib/unipile/linkedinUrl";
import {
  outreachTemplateVars,
  type OutreachLeadFields,
} from "@/lib/unipile/profileVars";

export type CampaignStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "archived";

export type StepType = "invite" | "message" | "wait" | "comment" | "react";

export type CampaignStepInput = {
  id?: string;
  position: number;
  step_type: StepType;
  body?: string | null;
  wait_hours?: number | null;
  variants?: Array<{ key: string; label?: string; body: string }> | null;
};

export async function listCampaigns(coachId: string) {
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select(
      "id, name, status, daily_invite_limit, min_action_delay_seconds, outreach_account_id, stats, created_at, updated_at"
    )
    .eq("coach_id", coachId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const campaigns = data ?? [];
  const withCounts = await Promise.all(
    campaigns.map(async (c) => {
      const { data: leadRows } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("status")
        .eq("campaign_id", c.id);

      const status_counts: Record<string, number> = {};
      for (const row of leadRows ?? []) {
        const s = (row.status as string) || "queued";
        status_counts[s] = (status_counts[s] || 0) + 1;
      }
      const lead_count = leadRows?.length ?? 0;
      const replied = status_counts.replied || 0;
      const interested =
        (status_counts.interested || 0) +
        (status_counts.assessment_sent || 0) +
        (status_counts.assessment_done || 0) +
        (status_counts.call_offered || 0);
      const failed = (status_counts.failed || 0) + (status_counts.skipped || 0);
      const connected =
        (status_counts.connected || 0) +
        (status_counts.in_sequence || 0) +
        (status_counts.replied || 0) +
        interested +
        (status_counts.completed || 0);
      const sent =
        (status_counts.invited || 0) +
        connected;

      return {
        ...c,
        lead_count,
        status_counts,
        progress: {
          sent,
          connected,
          replied: replied + interested,
          interested,
          failed,
          queued: status_counts.queued || 0,
          remaining: Math.max(0, lead_count - sent - failed),
        },
      };
    })
  );
  return withCounts;
}

export async function getCampaign(coachId: string, campaignId: string) {
  const { data: campaign, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!campaign) return null;

  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true });

  const { data: leads } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select(
      "id, contact_id, linkedin_url, linkedin_provider_id, first_name, last_name, company, title, status, interest_outcome, interest_note, interest_logged_at, ab_assignments, current_step_position, next_action_at, last_error, created_at"
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(500);

  return { campaign, steps: steps ?? [], leads: leads ?? [] };
}

export async function createCampaign(
  coachId: string,
  input: { name: string; outreach_account_id?: string | null }
) {
  const name = input.name.trim() || "Untitled campaign";
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .insert({
      coach_id: coachId,
      name,
      status: "draft",
      daily_invite_limit: 20,
      outreach_account_id: input.outreach_account_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Default: VIP get-interest sequence (A/B on openers)
  const { VIP_GET_INTEREST_PLAYBOOK } = await import("@/lib/unipile/playbooks");
  await replaceCampaignSteps(
    data.id,
    VIP_GET_INTEREST_PLAYBOOK.steps.map((s, i) => ({
      ...s,
      position: i,
    }))
  );
  return data;
}

export async function updateCampaign(
  coachId: string,
  campaignId: string,
  patch: Record<string, unknown>
) {
  const allowed = [
    "name",
    "status",
    "daily_invite_limit",
    "min_action_delay_seconds",
    "quiet_hours_start",
    "quiet_hours_end",
    "timezone",
    "stop_on_reply",
    "outreach_account_id",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in patch) update[key] = patch[key];
  }
  if (typeof update.daily_invite_limit === "number") {
    update.daily_invite_limit = Math.min(
      50,
      Math.max(1, Math.round(update.daily_invite_limit as number))
    );
  }
  if (typeof update.name === "string") {
    update.name = (update.name as string).trim() || "Untitled campaign";
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .update(update)
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function replaceCampaignSteps(
  campaignId: string,
  steps: CampaignStepInput[]
) {
  const cleaned = steps
    .map((s, i) => ({
      campaign_id: campaignId,
      position: i,
      step_type: s.step_type,
      body: s.step_type === "wait" ? null : (s.body ?? "").slice(0, 8000),
      wait_hours:
        s.step_type === "wait"
          ? Math.max(0.1, Number(s.wait_hours ?? 24))
          : null,
      variants:
        s.step_type === "message" && Array.isArray(s.variants) && s.variants.length
          ? s.variants
              .filter((v) => v?.key && v?.body)
              .map((v) => ({
                key: String(v.key).slice(0, 32),
                label: v.label ? String(v.label).slice(0, 120) : undefined,
                body: String(v.body).slice(0, 8000),
              }))
          : [],
    }))
    .filter((s) =>
      ["invite", "message", "wait", "comment", "react"].includes(s.step_type)
    );

  const { error: delErr } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .delete()
    .eq("campaign_id", campaignId);
  if (delErr) throw new Error(delErr.message);

  if (cleaned.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .insert(cleaned)
    .select("*")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type LeadImportRow = {
  linkedin_url: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  title?: string | null;
  linkedin_provider_id?: string | null;
};

export async function addCampaignLeads(
  coachId: string,
  campaignId: string,
  rows: LeadImportRow[]
) {
  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found.");

  let added = 0;
  let skipped = 0;
  for (const row of rows.slice(0, 500)) {
    const url = normalizeLinkedInProfileUrl(row.linkedin_url);
    if (!url) {
      skipped += 1;
      continue;
    }
    const providerHint = linkedInPublicIdentifier(url);

    // Upsert contact lightly when possible
    let contactId: string | null = null;
    const { data: existingContact } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("coach_id", coachId)
      .eq("linkedin_url", url)
      .maybeSingle();
    if (existingContact?.id) {
      contactId = existingContact.id as string;
    } else {
      const fullName = [row.first_name, row.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      const { data: created } = await supabaseAdmin
        .from("contacts")
        .insert({
          coach_id: coachId,
          type: "prospect",
          full_name: fullName || providerHint || "LinkedIn lead",
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
          business_name: row.company ?? null,
          job_title: row.title ?? null,
          linkedin_url: url,
          prospect_source: "linkedin_campaign",
        })
        .select("id")
        .maybeSingle();
      contactId = (created?.id as string) ?? null;
    }

    const { error } = await supabaseAdmin.from("linkedin_campaign_leads").insert({
      campaign_id: campaignId,
      coach_id: coachId,
      contact_id: contactId,
      linkedin_url: url,
      linkedin_provider_id: row.linkedin_provider_id ?? null,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      company: row.company ?? null,
      title: row.title ?? null,
      status: "queued",
      current_step_position: 0,
      next_action_at: new Date().toISOString(),
      metadata: providerHint ? { public_identifier: providerHint } : {},
    });
    if (error) {
      if (error.code === "23505") skipped += 1;
      else skipped += 1;
      continue;
    }
    added += 1;
  }

  const { data: campaignRow } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignRow?.status === "running" && added > 0) {
    await enqueuePendingJobsForCampaign(coachId, campaignId);
  }

  return { added, skipped };
}

export async function deleteCampaignLead(
  coachId: string,
  campaignId: string,
  leadId: string
) {
  const { error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .delete()
    .eq("id", leadId)
    .eq("campaign_id", campaignId)
    .eq("coach_id", coachId);
  if (error) throw new Error(error.message);
}

export async function setCampaignStatus(
  coachId: string,
  campaignId: string,
  status: CampaignStatus
) {
  const data = await updateCampaign(coachId, campaignId, { status });
  if (!data) throw new Error("Campaign not found.");

  if (status === "running") {
    await enqueuePendingJobsForCampaign(coachId, campaignId);
  }
  if (status === "paused") {
    await supabaseAdmin
      .from("linkedin_send_jobs")
      .update({ status: "cancelled" })
      .eq("campaign_id", campaignId)
      .eq("coach_id", coachId)
      .eq("status", "pending");
  }
  return data;
}

export async function enqueuePendingJobsForCampaign(
  coachId: string,
  campaignId: string
) {
  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true });
  if (!steps?.length) return { enqueued: 0 };

  const { data: leads } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("coach_id", coachId)
    .in("status", ["queued", "invited", "connected", "in_sequence"]);

  let enqueued = 0;
  for (const lead of leads ?? []) {
    const step = steps.find((s) => s.position === lead.current_step_position);
    if (!step) continue;
    if (step.step_type === "wait") continue;

    const { data: existing } = await supabaseAdmin
      .from("linkedin_send_jobs")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("step_id", step.id)
      .in("status", ["pending", "running"])
      .maybeSingle();
    if (existing) continue;

    const scheduled =
      lead.next_action_at && new Date(lead.next_action_at) > new Date()
        ? lead.next_action_at
        : new Date().toISOString();

    const { error } = await supabaseAdmin.from("linkedin_send_jobs").insert({
      coach_id: coachId,
      campaign_id: campaignId,
      lead_id: lead.id,
      step_id: step.id,
      scheduled_for: scheduled,
      status: "pending",
    });
    if (!error) enqueued += 1;
  }
  return { enqueued };
}

export function buildMessageBody(
  template: string,
  lead: OutreachLeadFields,
  extras?: Record<string, string | null | undefined>
) {
  return renderOutreachTemplate(template, outreachTemplateVars(lead, extras));
}

export async function applyCampaignPlaybook(
  coachId: string,
  campaignId: string,
  playbookId: string
) {
  const { getPlaybook } = await import("@/lib/unipile/playbooks");
  const playbook = getPlaybook(playbookId);
  if (!playbook) throw new Error("Playbook not found.");
  if (playbook.channel === "email") {
    throw new Error(
      "Email nurture playbooks are available to copy from the Interest queue snippets / catalog. Automated Gmail/Outlook send for multi-day email sequences is next — apply a LinkedIn playbook (VIP get-interest or Connector) for Unipile DMs today."
    );
  }
  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found.");
  const steps = await replaceCampaignSteps(
    campaignId,
    playbook.steps.map((s, i) => ({ ...s, position: i }))
  );
  return { playbook: { id: playbook.id, name: playbook.name }, steps };
}

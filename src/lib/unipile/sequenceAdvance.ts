import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clampWaitHours } from "@/lib/unipile/waitDuration";
import {
  addToCampaignIdFrom,
  callWaitFrom,
  inviteNoConnectFrom,
} from "@/lib/unipile/campaignStepTypes";

type StepRow = {
  id?: string;
  position: number;
  step_type: string;
  wait_hours?: number | null;
  config?: unknown;
};

export async function consumeNonOutboundSteps(input: {
  steps: StepRow[];
  lead: Record<string, unknown>;
  campaignId: string;
  coachId: string;
  startPosition: number;
}): Promise<{
  position: number;
  nextAction: Date;
  completed: boolean;
}> {
  let pos = input.startPosition;
  let nextAction = new Date();

  while (true) {
    const step = input.steps.find((s) => s.position === pos);
    if (!step) {
      return { position: pos, nextAction, completed: true };
    }
    const type = String(step.step_type);
    if (type === "wait") {
      const hours = clampWaitHours(Number(step.wait_hours ?? 24));
      nextAction = new Date(Date.now() + hours * 3600 * 1000);
      pos += 1;
      continue;
    }
    if (type === "notify") {
      pos += 1;
      continue;
    }
    if (type === "add_to_campaign") {
      await enrollLeadInOtherCampaign({
        coachId: input.coachId,
        sourceCampaignId: input.campaignId,
        targetCampaignId: addToCampaignIdFrom(step.config),
        lead: input.lead,
      });
      pos += 1;
      continue;
    }
    if (type === "call" && !callWaitFrom(step.config)) {
      await enqueueCallReminderJob({
        coachId: input.coachId,
        campaignId: input.campaignId,
        leadId: String(input.lead.id),
        stepId: step.id,
        scheduledFor: nextAction,
      });
      pos += 1;
      continue;
    }
    return { position: pos, nextAction, completed: false };
  }
}

async function enqueueCallReminderJob(input: {
  coachId: string;
  campaignId: string;
  leadId: string;
  stepId?: string;
  scheduledFor: Date;
}) {
  if (!input.stepId) return;
  const { data: existing } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("id")
    .eq("lead_id", input.leadId)
    .eq("step_id", input.stepId)
    .in("status", ["pending", "running", "awaiting_coach"])
    .maybeSingle();
  if (existing) return;
  await supabaseAdmin.from("linkedin_send_jobs").insert({
    coach_id: input.coachId,
    campaign_id: input.campaignId,
    lead_id: input.leadId,
    step_id: input.stepId,
    scheduled_for: input.scheduledFor.toISOString(),
    status: "awaiting_coach",
  });
}

export async function enrollLeadInOtherCampaign(input: {
  coachId: string;
  sourceCampaignId: string;
  targetCampaignId: string | null;
  lead: Record<string, unknown>;
}) {
  const targetId = input.targetCampaignId;
  if (!targetId || targetId === input.sourceCampaignId) return;

  const { data: target } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, status")
    .eq("id", targetId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (!target || target.status === "archived") return;

  const contactId =
    typeof input.lead.contact_id === "string" ? input.lead.contact_id : null;

  const { addCampaignLeads, addCampaignLeadsFromContacts } = await import(
    "@/lib/unipile/campaigns"
  );

  if (contactId) {
    await addCampaignLeadsFromContacts(input.coachId, targetId, [contactId]);
    return;
  }

  await addCampaignLeads(input.coachId, targetId, [
    {
      linkedin_url:
        typeof input.lead.linkedin_url === "string"
          ? input.lead.linkedin_url
          : null,
      linkedin_provider_id:
        typeof input.lead.linkedin_provider_id === "string"
          ? input.lead.linkedin_provider_id
          : null,
      first_name:
        typeof input.lead.first_name === "string"
          ? input.lead.first_name
          : null,
      last_name:
        typeof input.lead.last_name === "string" ? input.lead.last_name : null,
      company:
        typeof input.lead.company === "string" ? input.lead.company : null,
      title:
        typeof input.lead.title === "string" ? input.lead.title : null,
    },
  ]);
}

const INVITE_TIMEOUT_BATCH = 20;

/** After the wait on a connection invite, enrol the lead in another campaign. */
export async function processExpiredInviteTimeouts(): Promise<number> {
  const now = new Date().toISOString();
  const { data: leads, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select(
      "id, coach_id, campaign_id, contact_id, linkedin_url, linkedin_provider_id, first_name, last_name, company, title, current_step_position"
    )
    .eq("status", "invited")
    .lte("next_action_at", now)
    .not("next_action_at", "is", null)
    .limit(INVITE_TIMEOUT_BATCH);
  if (error || !leads?.length) return 0;

  let moved = 0;
  for (const lead of leads) {
    const campaignId = String(lead.campaign_id || "");
    const coachId = String(lead.coach_id || "");
    if (!campaignId || !coachId) continue;

    const { data: campaign } = await supabaseAdmin
      .from("linkedin_campaigns")
      .select("id, status")
      .eq("id", campaignId)
      .eq("coach_id", coachId)
      .maybeSingle();
    if (!campaign || campaign.status !== "running") continue;

    const { data: steps } = await supabaseAdmin
      .from("linkedin_campaign_steps")
      .select("position, step_type, config")
      .eq("campaign_id", campaignId)
      .order("position", { ascending: true });
    const pos = Number(lead.current_step_position ?? 0);
    const inviteStep =
      (steps ?? []).find(
        (s) => s.position === pos && s.step_type === "invite"
      ) ?? (steps ?? []).find((s) => s.step_type === "invite");
    const branch = inviteNoConnectFrom(inviteStep?.config);
    if (
      branch.on_no_connect !== "other_campaign" ||
      !branch.no_connect_campaign_id
    ) {
      await supabaseAdmin
        .from("linkedin_campaign_leads")
        .update({ next_action_at: null })
        .eq("id", lead.id);
      continue;
    }

    await enrollLeadInOtherCampaign({
      coachId,
      sourceCampaignId: campaignId,
      targetCampaignId: branch.no_connect_campaign_id,
      lead,
    });
    await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({
        status: "skipped",
        next_action_at: null,
        last_error: "Did not connect — moved to another campaign",
      })
      .eq("id", lead.id);
    moved += 1;
  }
  return moved;
}

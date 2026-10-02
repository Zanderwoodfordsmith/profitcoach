import { after } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createCampaignFromLibraryTemplate,
  listCoachCampaignTemplates,
} from "@/lib/campaignLibrary/instantiate";
import { CAMPAIGN_LIBRARY_KIND_LABEL } from "@/lib/campaignLibrary/types";
import {
  campaignPriorityLevelFromStored,
  campaignPriorityValues,
  CAMPAIGN_PRIORITY_LEVELS,
  type CampaignPriorityLevel,
} from "@/lib/unipile/campaignPriority";
import {
  createCampaign,
  enqueuePendingJobsForCampaign,
  getCampaign,
  listCampaigns,
  setCampaignStatus,
  updateCampaign,
} from "@/lib/unipile/campaigns";
import {
  DAILY_INVITE_LIMIT_MAX,
  DAILY_MESSAGE_LIMIT_MAX,
} from "@/lib/unipile/campaignSendWindow";
import { loadCoachLinkedInSendSettings } from "@/lib/unipile/accountSendPlan";
import { recommendedWeeklyInvites } from "@/lib/unipile/accountSendSafety";

import type { AgentToolContext, AgentToolDef, AgentToolInput, GateDecision } from "../types";
import { AgentToolError, coachOf, isUuid, num, plural, str } from "./util";

/** Campaigns: overview, detail, templates, create, settings and volume, on/off. */

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  channel: string | null;
  daily_invite_limit: number | null;
  daily_message_limit: number | null;
  outreach_priority: number | null;
  outreach_weight: number | null;
  outreach_account_id: string | null;
};

export async function loadCampaignRow(coachId: string, campaignId: string): Promise<CampaignRow> {
  if (!isUuid(campaignId)) throw new AgentToolError("Use a campaign id from list_campaigns.");
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select(
      "id, name, status, channel, daily_invite_limit, daily_message_limit, outreach_priority, outreach_weight, outreach_account_id"
    )
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new AgentToolError("Campaign not found for this coach.");
  return data as CampaignRow;
}

function priorityOf(row: { outreach_priority?: number | null; outreach_weight?: number | null }) {
  return campaignPriorityLevelFromStored(row.outreach_priority, row.outreach_weight);
}

function stepPreview(step: Record<string, unknown>) {
  const body = typeof step.body === "string" ? step.body : "";
  return {
    position: step.position,
    type: step.step_type,
    ...(step.step_type === "wait" ? { wait_hours: step.wait_hours } : {}),
    ...(step.send_mode ? { send_mode: step.send_mode } : {}),
    ...(body ? { body: body.length > 1_500 ? `${body.slice(0, 1_500)}… [preview shortened]` : body } : {}),
  };
}

type SettingsPatch = {
  name?: string;
  priority?: CampaignPriorityLevel;
  daily_invite_limit?: number;
  daily_message_limit?: number;
};

function settingsPatchFrom(input: AgentToolInput): SettingsPatch {
  const patch: SettingsPatch = {};
  const name = str(input, "name");
  if (name) patch.name = name;
  const priority = str(input, "priority");
  if ((CAMPAIGN_PRIORITY_LEVELS as readonly string[]).includes(priority)) {
    patch.priority = priority as CampaignPriorityLevel;
  }
  const invites = num(input, "daily_invite_limit");
  if (invites != null) patch.daily_invite_limit = Math.round(invites);
  const messages = num(input, "daily_message_limit");
  if (messages != null) patch.daily_message_limit = Math.round(messages);
  return patch;
}

async function settingsGate(input: AgentToolInput, ctx: AgentToolContext): Promise<GateDecision> {
  const coach = coachOf(ctx);
  const row = await loadCampaignRow(coach.id, str(input, "campaign_id"));
  const patch = settingsPatchFrom(input);
  if (!Object.keys(patch).length) return { error: "Nothing to change. Pass a name, priority or daily limit." };
  if (patch.daily_invite_limit != null && (patch.daily_invite_limit < 1 || patch.daily_invite_limit > DAILY_INVITE_LIMIT_MAX)) {
    return { error: `Daily invites must be between 1 and ${DAILY_INVITE_LIMIT_MAX}.` };
  }
  if (patch.daily_message_limit != null && (patch.daily_message_limit < 1 || patch.daily_message_limit > DAILY_MESSAGE_LIMIT_MAX)) {
    return { error: `Daily messages must be between 1 and ${DAILY_MESSAGE_LIMIT_MAX}.` };
  }
  const changesVolume =
    patch.priority != null || patch.daily_invite_limit != null || patch.daily_message_limit != null;
  if (row.status !== "running" || !changesVolume) return { confirm: false };

  const details = [{ label: "Campaign", value: `${row.name} (running)` }];
  if (patch.priority) details.push({ label: "Priority", value: `${priorityOf(row)} → ${patch.priority}` });
  if (patch.daily_invite_limit != null) {
    details.push({ label: "Invites a day", value: `${row.daily_invite_limit ?? 20} → ${patch.daily_invite_limit}` });
  }
  if (patch.daily_message_limit != null) {
    details.push({ label: "Messages a day", value: `${row.daily_message_limit ?? 20} → ${patch.daily_message_limit}` });
  }
  return { confirm: true, title: `Change the volume of ${row.name} for ${coach.name}`, details };
}

async function statusGate(input: AgentToolInput, ctx: AgentToolContext): Promise<GateDecision> {
  const coach = coachOf(ctx);
  const status = str(input, "status");
  if (status !== "running" && status !== "paused") return { error: 'Status must be "running" or "paused".' };
  const row = await loadCampaignRow(coach.id, str(input, "campaign_id"));
  if (status === "paused") return { confirm: false };
  if (row.status === "running") return { error: `${row.name} is already on.` };

  const [{ count: stepCount }, { count: queued }, { count: people }] = await Promise.all([
    supabaseAdmin.from("linkedin_campaign_steps").select("id", { count: "exact", head: true }).eq("campaign_id", row.id),
    supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", row.id)
      .eq("status", "queued"),
    supabaseAdmin.from("linkedin_campaign_leads").select("id", { count: "exact", head: true }).eq("campaign_id", row.id),
  ]);
  const isEmail = row.channel === "email";
  const account = isEmail ? null : await loadCoachLinkedInSendSettings(coach.id).catch(() => null);
  const missing: string[] = [];
  if (!stepCount) missing.push("it has no steps");
  if (!people) missing.push("it has no people");
  if (!isEmail && !account) missing.push(`${coach.name} has no connected LinkedIn account`);
  if (missing.length) return { error: `Cannot turn ${row.name} on yet: ${missing.join("; ")}.` };

  return {
    confirm: true,
    title: `Turn on ${row.name} for ${coach.name}`,
    details: [
      { label: "People", value: `${plural(people ?? 0, "person", "people")}, ${(queued ?? 0).toLocaleString("en-GB")} waiting to start` },
      { label: "Invites a day", value: String(row.daily_invite_limit ?? 20) },
      { label: "Priority", value: priorityOf(row) },
    ],
    warning: isEmail
      ? "Emails start going out in the next sending window."
      : "Connection requests start going out from their LinkedIn account in the next sending window.",
  };
}

export const campaignTools: AgentToolDef[] = [
  {
    name: "list_campaigns",
    label: "Looking at campaigns",
    needsCoach: true,
    description:
      "The active coach's campaigns (not archived): on or off, channel, priority, daily limits, people and progress.",
    input_schema: { type: "object", properties: {} },
    run: async (_input, ctx) => {
      const coach = coachOf(ctx);
      const campaigns = await listCampaigns(coach.id);
      return {
        campaigns: campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          channel: c.channel ?? "linkedin",
          priority: priorityOf(c),
          daily_invites: c.daily_invite_limit,
          daily_messages: c.daily_message_limit ?? null,
          people: c.lead_count,
          progress: {
            invited: c.progress.sent,
            connected: c.progress.connected,
            replied: c.progress.replied,
            interested: c.progress.interested,
            waiting: c.progress.queued,
          },
        })),
      };
    },
  },
  {
    name: "get_campaign",
    label: "Opening the campaign",
    needsCoach: true,
    description:
      "One campaign in detail: settings, the full sequence of steps (with message text), and how many people are at each status.",
    input_schema: {
      type: "object",
      properties: { campaign_id: { type: "string" } },
      required: ["campaign_id"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const id = str(input, "campaign_id");
      if (!isUuid(id)) throw new AgentToolError("Use a campaign id from list_campaigns.");
      const detail = await getCampaign(coach.id, id, { includeJobs: false });
      if (!detail) throw new AgentToolError("Campaign not found for this coach.");
      const campaign = detail.campaign as Record<string, unknown>;
      const statusCounts: Record<string, number> = {};
      for (const lead of detail.leads) {
        const status = String(lead.status ?? "queued");
        statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      }
      return {
        id,
        name: campaign.name,
        status: campaign.status,
        channel: campaign.channel ?? "linkedin",
        priority: priorityOf(campaign as CampaignRow),
        daily_invites: campaign.daily_invite_limit,
        daily_messages: campaign.daily_message_limit,
        linkedin_account: campaign.outreach_account_id
          ? "attached"
          : (await loadCoachLinkedInSendSettings(coach.id).catch(() => null))
            ? "not attached yet; the coach's connected LinkedIn account is attached automatically when it is turned on"
            : "none: the coach has no connected LinkedIn account",
        steps: (detail.steps as Record<string, unknown>[]).map(stepPreview),
        people: detail.leads.length,
        people_by_status: statusCounts,
      };
    },
  },
  {
    name: "list_campaign_templates",
    label: "Looking at templates",
    description:
      "Published campaign templates from the Campaign library, by kind: connector (Connection), reactivation, nurture (Ongoing nurture), positive_reply (Positive replies).",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const templates = await listCoachCampaignTemplates();
      return {
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          kind: CAMPAIGN_LIBRARY_KIND_LABEL[t.kind] ?? t.kind,
          description: t.description,
          steps: t.step_count,
        })),
      };
    },
  },
  {
    name: "create_campaign",
    label: "Creating the campaign",
    needsCoach: true,
    description:
      "Create a draft campaign for the active coach, from a library template (copies its steps and settings) or blank. Drafts send nothing.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        template_id: { type: "string", description: "From list_campaign_templates. Leave out for a blank campaign" },
        channel: { type: "string", enum: ["linkedin", "email", "whatsapp"], description: "Blank campaigns only. Default linkedin" },
      },
      required: ["name"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const name = str(input, "name");
      const templateId = str(input, "template_id");
      const campaign = templateId
        ? await createCampaignFromLibraryTemplate(coach.id, { name, templateId })
        : await createCampaign(coach.id, {
            name,
            channel:
              str(input, "channel") === "email"
                ? "email"
                : str(input, "channel") === "whatsapp"
                  ? "whatsapp"
                  : "linkedin",
          });
      const { count } = await supabaseAdmin
        .from("linkedin_campaign_steps")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id);
      return { campaign_id: campaign.id, name: campaign.name, status: campaign.status, steps: count ?? 0 };
    },
  },
  {
    name: "update_campaign_settings",
    label: "Updating the campaign",
    needsCoach: true,
    description:
      "Rename a campaign or change its volume: priority (low, medium, high) and daily invite and message limits. Asks for confirmation when the campaign is running and volume changes.",
    input_schema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        name: { type: "string" },
        priority: { type: "string", enum: [...CAMPAIGN_PRIORITY_LEVELS] },
        daily_invite_limit: { type: "number" },
        daily_message_limit: { type: "number" },
      },
      required: ["campaign_id"],
    },
    gate: settingsGate,
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const row = await loadCampaignRow(coach.id, str(input, "campaign_id"));
      const patch = settingsPatchFrom(input);
      const update: Record<string, unknown> = {};
      if (patch.name) update.name = patch.name;
      if (patch.priority) Object.assign(update, campaignPriorityValues(patch.priority));
      if (patch.daily_invite_limit != null) update.daily_invite_limit = patch.daily_invite_limit;
      if (patch.daily_message_limit != null) update.daily_message_limit = patch.daily_message_limit;
      const saved = await updateCampaign(coach.id, row.id, update);
      if (!saved) throw new AgentToolError("Campaign not found.");
      return {
        campaign_id: row.id,
        name: saved.name,
        priority: priorityOf(saved as CampaignRow),
        daily_invites: saved.daily_invite_limit,
        daily_messages: saved.daily_message_limit,
      };
    },
  },
  {
    name: "set_campaign_status",
    label: "Switching the campaign",
    needsCoach: true,
    description:
      'Turn a campaign on ("running") or pause it ("paused"). Turning on asks for confirmation and needs steps, people and a connected LinkedIn account.',
    input_schema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        status: { type: "string", enum: ["running", "paused"] },
      },
      required: ["campaign_id", "status"],
    },
    gate: statusGate,
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const row = await loadCampaignRow(coach.id, str(input, "campaign_id"));
      const status = str(input, "status") === "running" ? "running" : "paused";
      const saved = await setCampaignStatus(coach.id, row.id, status);
      if (status === "running") {
        const enqueue = () =>
          enqueuePendingJobsForCampaign(coach.id, row.id).catch((err) => {
            console.error("agent enqueuePendingJobsForCampaign:", err);
          });
        try {
          after(enqueue);
        } catch {
          void enqueue();
        }
      }
      return { campaign_id: row.id, name: saved.name, status: saved.status };
    },
  },
  {
    name: "get_sending_limits",
    label: "Checking sending limits",
    needsCoach: true,
    description:
      "The LinkedIn account's weekly connection-request target, daily messages, SSI score and the recommended weekly invites. The account total caps every campaign.",
    input_schema: { type: "object", properties: {} },
    run: async (_input, ctx) => {
      const coach = coachOf(ctx);
      const account = await loadCoachLinkedInSendSettings(coach.id);
      if (!account) return { connected: false };
      return {
        connected: true,
        weekly_invites: account.weekly_invite_target,
        daily_messages: account.daily_message_target,
        ssi_score: account.ssi_score,
        recommended_weekly_invites: recommendedWeeklyInvites(account.ssi_score),
        warming_up: account.warmup_enabled,
        invites_paused_until: account.invite_paused_until,
      };
    },
  },
];

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addLeadListToCampaign } from "@/lib/leadLists/addListToCampaign";
import { isLeadListUuid, loadOwnedLeadList } from "@/lib/leadLists/audienceLists";
import {
  deleteCampaignLeads,
  pauseCampaignLeads,
  resumeCampaignLeads,
} from "@/lib/unipile/campaigns";

import type { AgentToolContext, AgentToolDef, AgentToolInput, GateDecision } from "../types";
import { loadCampaignRow } from "./campaigns";
import { AgentToolError, coachOf, num, personName, plural, str, uuidList } from "./util";

/** Moving people into, out of and within campaigns. */

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  status: string | null;
  current_step_position: number | null;
};

const PAGE = 1_000;

async function loadLeads(coachId: string, campaignId: string, ids?: string[]): Promise<LeadRow[]> {
  const rows: LeadRow[] = [];
  for (let from = 0; from < 20_000; from += PAGE) {
    let query = supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id, first_name, last_name, company, title, status, current_step_position")
      .eq("campaign_id", campaignId)
      .eq("coach_id", coachId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (ids) query = query.in("id", ids);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as LeadRow[]));
    if (!data || data.length < PAGE || ids) break;
  }
  return rows;
}

function names(rows: LeadRow[], max = 8): string {
  const shown = rows.slice(0, max).map((row) => personName(row));
  const more = rows.length - shown.length;
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ");
}

/** Lead ids that really belong to this coach's campaign, with their rows. */
async function ownedLeads(input: AgentToolInput, ctx: AgentToolContext) {
  const coach = coachOf(ctx);
  const campaign = await loadCampaignRow(coach.id, str(input, "campaign_id"));
  const ids = uuidList(input, "lead_ids");
  if (!ids.length) throw new AgentToolError("Pass lead ids from list_campaign_people.");
  const rows = await loadLeads(coach.id, campaign.id, ids);
  if (!rows.length) throw new AgentToolError("None of those people are in this campaign.");
  return { coach, campaign, rows };
}

async function addListGate(input: AgentToolInput, ctx: AgentToolContext): Promise<GateDecision> {
  const coach = coachOf(ctx);
  const campaign = await loadCampaignRow(coach.id, str(input, "campaign_id"));
  const listId = str(input, "list_id");
  if (!isLeadListUuid(listId)) return { error: "Use a list id from list_lists." };
  const list = await loadOwnedLeadList(coach.id, listId);
  if (!list) return { error: "List not found for this coach." };
  if (list.kind === "blacklist") return { error: "The Blacklist can never be added to a campaign." };
  const itemIds = uuidList(input, "item_ids");
  if (list.kind === "pool" && !itemIds.length) {
    return { error: "Do not add the whole Pool. Use a named list, or pass item_ids." };
  }
  if (campaign.status !== "running") return { confirm: false };
  const count = itemIds.length || list.item_count || 0;
  return {
    confirm: true,
    title: `Add ${itemIds.length ? plural(count, "person", "people") : `the list ${list.name}`} to ${campaign.name}`,
    details: [
      { label: "For", value: coach.name },
      { label: "List", value: `${list.name} (${plural(list.item_count ?? 0, "person", "people")})` },
      { label: "Campaign", value: `${campaign.name} (running)` },
      { label: "Skips", value: "Anyone already in a campaign, blacklisted, or without a LinkedIn profile" },
    ],
    warning: "The campaign is on, so they start receiving its first step in the next sending window.",
  };
}

export const campaignPeopleTools: AgentToolDef[] = [
  {
    name: "add_list_to_campaign",
    label: "Adding people to the campaign",
    needsCoach: true,
    description:
      "Add everyone on a list (or just item_ids from get_list_people) to a campaign. Skips people already in a campaign, blacklisted, or without a LinkedIn profile (email for email campaigns). Asks for confirmation when the campaign is running.",
    input_schema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        campaign_id: { type: "string" },
        item_ids: { type: "array", items: { type: "string" }, description: "Only these people from the list" },
      },
      required: ["list_id", "campaign_id"],
    },
    gate: addListGate,
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const itemIds = uuidList(input, "item_ids");
      const result = await addLeadListToCampaign({
        coachId: coach.id,
        listId: str(input, "list_id"),
        campaignId: str(input, "campaign_id"),
        itemIds,
        all: itemIds.length === 0,
      });
      return {
        added: result.added,
        already_in_a_campaign_or_duplicate: result.skipped,
        blacklisted: result.blacklisted,
        no_linkedin_or_email: result.unreachable,
        looked_at: result.considered,
      };
    },
  },
  {
    name: "list_campaign_people",
    label: "Looking at people in the campaign",
    needsCoach: true,
    description:
      "People in a campaign with their lead ids and status (queued, invited, connected, in_sequence, replied, interested, paused, completed, failed). Search by name, company or title.",
    input_schema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        search: { type: "string" },
        status: { type: "string" },
        limit: { type: "number", description: "Default 25, max 100" },
      },
      required: ["campaign_id"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const campaign = await loadCampaignRow(coach.id, str(input, "campaign_id"));
      const search = str(input, "search").toLowerCase();
      const status = str(input, "status").toLowerCase();
      const limit = Math.min(100, Math.max(1, num(input, "limit") ?? 25));
      const all = await loadLeads(coach.id, campaign.id);
      const matches = all.filter((row) => {
        if (status && (row.status ?? "queued") !== status) return false;
        if (!search) return true;
        const haystack = [row.first_name, row.last_name, row.company, row.title]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return search.split(/\s+/).every((word) => haystack.includes(word));
      });
      return {
        campaign: campaign.name,
        total_in_campaign: all.length,
        matches: matches.length,
        showing: matches.slice(0, limit).map((row) => ({
          lead_id: row.id,
          name: personName(row),
          company: row.company,
          title: row.title,
          status: row.status ?? "queued",
          step: row.current_step_position,
        })),
      };
    },
  },
  {
    name: "remove_people_from_campaign",
    label: "Removing people",
    needsCoach: true,
    description:
      "Remove people from one campaign (they stay on their lists). Asks for confirmation.",
    input_schema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        lead_ids: { type: "array", items: { type: "string" } },
      },
      required: ["campaign_id", "lead_ids"],
    },
    gate: async (input, ctx) => {
      const { coach, campaign, rows } = await ownedLeads(input, ctx);
      return {
        confirm: true,
        title: `Remove ${plural(rows.length, "person", "people")} from ${campaign.name}`,
        details: [
          { label: "For", value: coach.name },
          { label: "People", value: names(rows) },
        ],
        warning: "Their progress in this campaign is deleted. They stay on their lists.",
      };
    },
    run: async (input, ctx) => {
      const { coach, campaign, rows } = await ownedLeads(input, ctx);
      const result = await deleteCampaignLeads(coach.id, campaign.id, rows.map((row) => row.id));
      return { removed: result.deleted, campaign: campaign.name };
    },
  },
  {
    name: "pause_people",
    label: "Pausing people",
    needsCoach: true,
    description: "Pause people in a campaign. They stop at their current step until resumed.",
    input_schema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        lead_ids: { type: "array", items: { type: "string" } },
      },
      required: ["campaign_id", "lead_ids"],
    },
    run: async (input, ctx) => {
      const { coach, campaign, rows } = await ownedLeads(input, ctx);
      const result = await pauseCampaignLeads(coach.id, campaign.id, rows.map((row) => row.id));
      return { paused: result.updated, campaign: campaign.name };
    },
  },
  {
    name: "resume_people",
    label: "Resuming people",
    needsCoach: true,
    description:
      "Resume paused people in a campaign. Asks for confirmation when the campaign is running.",
    input_schema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        lead_ids: { type: "array", items: { type: "string" } },
      },
      required: ["campaign_id", "lead_ids"],
    },
    gate: async (input, ctx) => {
      const { coach, campaign, rows } = await ownedLeads(input, ctx);
      if (campaign.status !== "running") return { confirm: false };
      return {
        confirm: true,
        title: `Resume ${plural(rows.length, "person", "people")} in ${campaign.name}`,
        details: [
          { label: "For", value: coach.name },
          { label: "People", value: names(rows) },
        ],
        warning: "The campaign is on, so their next step can go out today.",
      };
    },
    run: async (input, ctx) => {
      const { coach, campaign, rows } = await ownedLeads(input, ctx);
      const result = await resumeCampaignLeads(coach.id, campaign.id, rows.map((row) => row.id));
      return { resumed: result.updated, campaign: campaign.name };
    },
  },
];

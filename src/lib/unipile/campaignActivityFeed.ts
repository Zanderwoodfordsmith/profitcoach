import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CampaignFeedItem = {
  id: string;
  at: string;
  stepType: string;
  campaignId: string;
  campaignName: string;
  leadId: string;
  contactId: string | null;
  leadStatus: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
};

export type CampaignActivityFeed = {
  sent: CampaignFeedItem[];
  planned: CampaignFeedItem[];
  waiting: CampaignFeedItem[];
};

type JobRow = {
  id: string;
  campaign_id: string;
  lead_id: string;
  step_id: string;
  at: string;
};

async function hydrateJobs(
  coachId: string,
  jobs: JobRow[]
): Promise<CampaignFeedItem[]> {
  if (!jobs.length) return [];

  const campaignIds = [...new Set(jobs.map((job) => job.campaign_id))];
  const leadIds = [...new Set(jobs.map((job) => job.lead_id))];
  const stepIds = [...new Set(jobs.map((job) => job.step_id))];

  const [{ data: campaigns }, { data: leads }, { data: steps }] =
    await Promise.all([
      supabaseAdmin
        .from("linkedin_campaigns")
        .select("id, name, status")
        .eq("coach_id", coachId)
        .in("id", campaignIds),
      supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("id, first_name, last_name, company, status, contact_id")
        .eq("coach_id", coachId)
        .in("id", leadIds),
      supabaseAdmin
        .from("linkedin_campaign_steps")
        .select("id, step_type")
        .in("id", stepIds),
    ]);

  const campaignById = new Map(
    (campaigns ?? []).map((row) => [row.id as string, row])
  );
  const leadById = new Map((leads ?? []).map((row) => [row.id as string, row]));
  const stepById = new Map((steps ?? []).map((row) => [row.id as string, row]));

  const items: CampaignFeedItem[] = [];
  for (const job of jobs) {
    const campaign = campaignById.get(job.campaign_id);
    const lead = leadById.get(job.lead_id);
    if (!campaign || !lead) continue;
    items.push({
      id: job.id,
      at: job.at,
      stepType: String(stepById.get(job.step_id)?.step_type || "message"),
      campaignId: job.campaign_id,
      campaignName: String(campaign.name || "Campaign"),
      leadId: job.lead_id,
      contactId: (lead.contact_id as string | null) ?? null,
      leadStatus: (lead.status as string | null) ?? null,
      firstName: (lead.first_name as string | null) ?? null,
      lastName: (lead.last_name as string | null) ?? null,
      company: (lead.company as string | null) ?? null,
    });
  }
  return items;
}

export async function loadCampaignActivityFeed(
  coachId: string
): Promise<CampaignActivityFeed> {
  const [{ data: sentJobs, error: sentError }, { data: plannedJobs, error: plannedError }] =
    await Promise.all([
      supabaseAdmin
        .from("linkedin_send_jobs")
        .select("id, campaign_id, lead_id, step_id, updated_at")
        .eq("coach_id", coachId)
        .eq("status", "succeeded")
        .order("updated_at", { ascending: false })
        .limit(60),
      supabaseAdmin
        .from("linkedin_send_jobs")
        .select("id, campaign_id, lead_id, step_id, scheduled_for")
        .eq("coach_id", coachId)
        .eq("status", "pending")
        .order("scheduled_for", { ascending: true })
        .limit(80),
    ]);

  if (sentError) throw new Error(sentError.message);
  if (plannedError) throw new Error(plannedError.message);

  const sent = await hydrateJobs(
    coachId,
    (sentJobs ?? []).map((row) => ({
      id: row.id as string,
      campaign_id: row.campaign_id as string,
      lead_id: row.lead_id as string,
      step_id: row.step_id as string,
      at: String(row.updated_at || ""),
    }))
  );

  const plannedHydrated = await hydrateJobs(
    coachId,
    (plannedJobs ?? []).map((row) => ({
      id: row.id as string,
      campaign_id: row.campaign_id as string,
      lead_id: row.lead_id as string,
      step_id: row.step_id as string,
      at: String(row.scheduled_for || ""),
    }))
  );

  const { data: running } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, name")
    .eq("coach_id", coachId)
    .eq("status", "running");

  const runningIds = (running ?? []).map((row) => row.id as string);
  const campaignNameById = new Map(
    (running ?? []).map((row) => [row.id as string, String(row.name || "Campaign")])
  );

  const planned = plannedHydrated.filter((item) =>
    runningIds.includes(item.campaignId)
  );

  if (!runningIds.length) {
    return { sent, planned, waiting: [] };
  }

  const busyLeadIds = new Set(planned.map((item) => item.leadId));
  const { data: awaiting } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select("lead_id")
    .eq("coach_id", coachId)
    .eq("status", "awaiting_coach")
    .in("campaign_id", runningIds);
  for (const row of awaiting ?? []) {
    busyLeadIds.add(row.lead_id as string);
  }

  const { data: queuedLeads } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id, campaign_id, contact_id, first_name, last_name, company, next_action_at, status")
    .eq("coach_id", coachId)
    .eq("status", "queued")
    .in("campaign_id", runningIds)
    .order("created_at", { ascending: true })
    .limit(80);

  const waiting: CampaignFeedItem[] = [];
  for (const lead of queuedLeads ?? []) {
    const leadId = lead.id as string;
    if (busyLeadIds.has(leadId)) continue;
    const campaignId = lead.campaign_id as string;
    waiting.push({
      id: `waiting-${leadId}`,
      at: String(lead.next_action_at || ""),
      stepType: "invite",
      campaignId,
      campaignName: campaignNameById.get(campaignId) || "Campaign",
      leadId,
      contactId: (lead.contact_id as string | null) ?? null,
      leadStatus: (lead.status as string | null) ?? "queued",
      firstName: (lead.first_name as string | null) ?? null,
      lastName: (lead.last_name as string | null) ?? null,
      company: (lead.company as string | null) ?? null,
    });
    if (waiting.length >= 40) break;
  }

  return { sent, planned, waiting };
}

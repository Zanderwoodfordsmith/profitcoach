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
import {
  campaignChannelsFromSteps,
  campaignStepCreatesJob,
  parseManualFallbackHours,
  type CampaignStepMedia,
  type CampaignStepMediaKind,
  type CampaignStepType,
} from "@/lib/unipile/campaignStepTypes";
import { cleanCampaignStepsForSave } from "@/lib/unipile/campaignStepReplace";
import { patchesAfterDeletedWait } from "@/lib/unipile/campaignLeadActivity";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { splitFullName } from "@/lib/splitFullName";
import { mergeSocialUrls, socialUrlsFromUnknown } from "@/lib/unipile/socialUrls";
import { normalizeFacebookProfileUrl } from "@/lib/unipile/facebookIdentity";
import { normalizeInstagramProfileUrl } from "@/lib/unipile/instagramIdentity";
import { campaignPriorityValues } from "@/lib/unipile/campaignPriority";
import {
  clampDailyLimit,
  DAILY_INVITE_LIMIT_MAX,
  DAILY_MESSAGE_LIMIT_MAX,
  DAILY_REACT_LIMIT_MAX,
  DEFAULT_CAMPAIGN_SEND_RULES,
  nextCampaignSendAt,
  parseCampaignSendRules,
  staggerInviteActionTimes,
} from "@/lib/unipile/campaignSendWindow";
import {
  classifyLeadReply,
  emptyReplyCounts,
} from "@/lib/unipile/interest";
import { parseLinkedInIdentity } from "@/lib/contacts/linkedinIdentity";
import { normalizePoolEmail, normalizePoolPhone } from "@/lib/pool/identity";

const CONTACT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CampaignStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "archived";

export type StepType = CampaignStepType;

export type CampaignStepInput = {
  id?: string;
  position: number;
  step_type: StepType;
  body?: string | null;
  wait_hours?: number | null;
  variants?: Array<{
    key: string;
    label?: string;
    body: string;
    media_kind?: CampaignStepMediaKind | null;
    media?: CampaignStepMedia | null;
  }> | null;
  send_mode?: "auto" | "remind" | null;
  fallback_hours?: number | null;
  fallback_body?: string | null;
  config?: Record<string, unknown> | null;
};

const CAMPAIGN_LIST_SELECT =
  "id, name, status, channel, source_playbook_id, daily_invite_limit, daily_message_limit, daily_react_limit, min_action_delay_seconds, timezone, send_rules, outreach_account_id, outreach_priority, outreach_weight, stats, created_at, updated_at";

type CampaignListRow = {
  id: string;
  name: string;
  status: string;
  channel?: string | null;
  source_playbook_id?: string | null;
  daily_invite_limit: number;
  daily_message_limit?: number | null;
  daily_react_limit?: number | null;
  min_action_delay_seconds?: number | null;
  timezone?: string | null;
  send_rules?: unknown;
  outreach_account_id?: string | null;
  outreach_priority?: number | null;
  outreach_weight?: number | null;
  stats?: unknown;
  created_at?: string;
  updated_at: string;
};

async function withCampaignListCounts(campaigns: CampaignListRow[]) {
  const campaignIds = campaigns.map((c) => c.id);
  const stepTypesByCampaign = new Map<string, string[]>();
  if (campaignIds.length > 0) {
    const { data: stepRows } = await supabaseAdmin
      .from("linkedin_campaign_steps")
      .select("campaign_id, step_type")
      .in("campaign_id", campaignIds);
    for (const row of stepRows ?? []) {
      const id = row.campaign_id as string | null;
      if (!id) continue;
      const list = stepTypesByCampaign.get(id) ?? [];
      list.push(String(row.step_type ?? ""));
      stepTypesByCampaign.set(id, list);
    }
  }

  return Promise.all(
    campaigns.map(async (c) => {
      const { data: leadRows } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("status, interest_outcome")
        .eq("campaign_id", c.id);

      const status_counts: Record<string, number> = {};
      const replies = emptyReplyCounts();
      for (const row of leadRows ?? []) {
        const s = (row.status as string) || "queued";
        status_counts[s] = (status_counts[s] || 0) + 1;
        const sentiment = classifyLeadReply(
          s,
          row.interest_outcome as string | null
        );
        if (sentiment) replies[sentiment] += 1;
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
      const sent = (status_counts.invited || 0) + connected;

      const stepTypes = stepTypesByCampaign.get(c.id) ?? [];
      return {
        ...c,
        lead_count,
        has_invite_step: stepTypes.includes("invite"),
        channels: campaignChannelsFromSteps(
          stepTypes,
          c.channel ?? undefined
        ),
        status_counts,
        progress: {
          sent,
          connected,
          replied: replied + interested,
          interested,
          failed,
          queued: status_counts.queued || 0,
          remaining: Math.max(0, lead_count - sent - failed),
          in_followup:
            (status_counts.invited || 0) +
            (status_counts.connected || 0) +
            (status_counts.in_sequence || 0) +
            (status_counts.paused || 0),
          replies,
        },
      };
    })
  );
}

export async function listCampaigns(coachId: string) {
  try {
    const { ensureDefaultCampaigns } = await import(
      "@/lib/unipile/defaultCampaigns"
    );
    await ensureDefaultCampaigns(coachId);
  } catch (err) {
    console.error("ensureDefaultCampaigns:", err);
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select(CAMPAIGN_LIST_SELECT)
    .eq("coach_id", coachId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  return withCampaignListCounts((data ?? []) as CampaignListRow[]);
}

/** Same row shape as active campaigns (progress, channels, queue). */
export async function listArchivedCampaigns(coachId: string) {
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select(CAMPAIGN_LIST_SELECT)
    .eq("coach_id", coachId)
    .eq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return withCampaignListCounts((data ?? []) as CampaignListRow[]);
}

export async function campaignOwnedByCoach(
  coachId: string,
  campaignId: string
) {
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

const CAMPAIGN_JOBS_SELECT =
  "id, lead_id, step_id, status, scheduled_for, last_error, updated_at";

export async function getCampaignJobs(campaignId: string) {
  const jobsRes = await supabaseAdmin
    .from("linkedin_send_jobs")
    .select(CAMPAIGN_JOBS_SELECT)
    .eq("campaign_id", campaignId)
    .order("scheduled_for", { ascending: true })
    .limit(8000);
  if (jobsRes.error) {
    console.error("linkedin_send_jobs:", jobsRes.error.message);
    return [];
  }
  return jobsRes.data ?? [];
}

export async function getCampaign(
  coachId: string,
  campaignId: string,
  options?: { includeJobs?: boolean }
) {
  const includeJobs = options?.includeJobs !== false;
  const { data: campaign, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!campaign) return null;

  const dailyLimit =
    typeof campaign.daily_invite_limit === "number"
      ? campaign.daily_invite_limit
      : 20;

  // Older enrollments stamped every lead "due now". Re-pace once when the
  // queue is clearly over today's invite capacity.
  {
    const { data: queuedProbe } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id, next_action_at")
      .eq("campaign_id", campaignId)
      .eq("coach_id", coachId)
      .eq("status", "queued")
      .limit(2500);
    const dueBunch = (queuedProbe ?? []).filter((row) => {
      if (!row.next_action_at) return true;
      return (
        new Date(String(row.next_action_at)).getTime() <=
        Date.now() + 12 * 3600 * 1000
      );
    }).length;
    if (dueBunch > dailyLimit) {
      await restaggerQueuedLeadTimes(coachId, campaignId, {
        dailyInviteLimit: dailyLimit,
        timezone: (campaign.timezone as string | null) ?? null,
        sendRules: campaign.send_rules,
      });
    }
  }

  const [{ data: steps, error: stepsError }, { data: leads, error: leadsError }, jobs] =
    await Promise.all([
      supabaseAdmin
        .from("linkedin_campaign_steps")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("position", { ascending: true }),
      supabaseAdmin
        .from("linkedin_campaign_leads")
        .select(
          "id, contact_id, linkedin_url, linkedin_provider_id, first_name, last_name, company, title, status, interest_outcome, interest_note, interest_logged_at, ab_assignments, current_step_position, next_action_at, last_error, created_at"
        )
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(2500),
      includeJobs ? getCampaignJobs(campaignId) : Promise.resolve([]),
    ]);

  if (stepsError) throw new Error(stepsError.message);
  if (leadsError) throw new Error(leadsError.message);

  const { signCampaignStepMedia, mediaFromStepConfig } = await import(
    "@/lib/unipile/campaignStepMedia"
  );
  const signedSteps = await Promise.all(
    (steps ?? []).map(async (step) => {
      const media = mediaFromStepConfig(step.config);
      if (!media) return step;
      const signed = await signCampaignStepMedia(media);
      return {
        ...step,
        config: {
          ...((step.config as Record<string, unknown> | null) ?? {}),
          media: signed,
        },
      };
    })
  );

  return {
    campaign,
    steps: signedSteps,
    leads: leads ?? [],
    jobs,
  };
}

export async function createCampaign(
  coachId: string,
  input: {
    name: string;
    outreach_account_id?: string | null;
    channel?: "linkedin" | "email";
  }
) {
  const name = input.name.trim() || "Untitled campaign";
  const channel = input.channel === "email" ? "email" : "linkedin";
  const priority = campaignPriorityValues("medium");
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .insert({
      coach_id: coachId,
      name,
      status: "draft",
      channel,
      daily_invite_limit: 20,
      daily_message_limit: 20,
      daily_react_limit: 20,
      timezone: "Europe/London",
      send_rules: DEFAULT_CAMPAIGN_SEND_RULES,
      outreach_account_id: input.outreach_account_id ?? null,
      outreach_priority: priority.outreach_priority,
      outreach_weight: priority.outreach_weight,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  if (channel === "email" && data?.id) {
    await supabaseAdmin.from("linkedin_campaign_steps").insert({
      campaign_id: data.id,
      position: 0,
      step_type: "email",
      body: "Subject: Hello\nPreview: \n\n",
    });
  }
  return data;
}

/** Copy settings + steps into a new draft. Does not copy leads. */
export async function duplicateCampaign(coachId: string, campaignId: string) {
  const detail = await getCampaign(coachId, campaignId, { includeJobs: false });
  if (!detail) throw new Error("Campaign not found.");

  const source = detail.campaign as {
    name: string;
    daily_invite_limit?: number | null;
    daily_message_limit?: number | null;
    daily_react_limit?: number | null;
    min_action_delay_seconds?: number | null;
    quiet_hours_start?: string | null;
    quiet_hours_end?: string | null;
    timezone?: string | null;
    send_rules?: unknown;
    stop_on_reply?: boolean | null;
    outreach_account_id?: string | null;
    outreach_priority?: number | null;
    outreach_weight?: number | null;
    manual_fallback_hours?: number | null;
  };

  const copyName = `${String(source.name || "Untitled campaign").trim()} (copy)`.slice(
    0,
    200
  );

  const fallbackPriority = campaignPriorityValues("medium");

  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .insert({
      coach_id: coachId,
      name: copyName,
      status: "draft",
      daily_invite_limit: source.daily_invite_limit ?? 20,
      daily_message_limit: source.daily_message_limit ?? 20,
      daily_react_limit: source.daily_react_limit ?? 20,
      min_action_delay_seconds: source.min_action_delay_seconds ?? null,
      quiet_hours_start: source.quiet_hours_start ?? null,
      quiet_hours_end: source.quiet_hours_end ?? null,
      timezone: source.timezone ?? "Europe/London",
      send_rules: parseCampaignSendRules(source.send_rules),
      stop_on_reply: source.stop_on_reply ?? true,
      outreach_account_id: source.outreach_account_id ?? null,
      outreach_priority:
        source.outreach_priority ?? fallbackPriority.outreach_priority,
      outreach_weight:
        source.outreach_weight ?? fallbackPriority.outreach_weight,
      manual_fallback_hours: parseManualFallbackHours(
        source.manual_fallback_hours
      ),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const stepInputs: CampaignStepInput[] = (detail.steps ?? []).map(
    (s: Record<string, unknown>, i: number) => ({
      position: i,
      step_type: s.step_type as StepType,
      body: (s.body as string | null) ?? null,
      wait_hours: (s.wait_hours as number | null) ?? null,
      variants: Array.isArray(s.variants)
        ? (s.variants as CampaignStepInput["variants"])
        : null,
      send_mode: (s.send_mode as "auto" | "remind" | null) ?? null,
      fallback_hours: (s.fallback_hours as number | null) ?? null,
      fallback_body: (s.fallback_body as string | null) ?? null,
      config:
        s.config && typeof s.config === "object"
          ? (s.config as Record<string, unknown>)
          : null,
    })
  );

  if (stepInputs.length > 0) {
    await replaceCampaignSteps(data.id, stepInputs);
  }

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
    "daily_message_limit",
    "daily_react_limit",
    "min_action_delay_seconds",
    "quiet_hours_start",
    "quiet_hours_end",
    "timezone",
    "send_rules",
    "stop_on_reply",
    "outreach_account_id",
    "channel",
    "outreach_priority",
    "outreach_weight",
    "manual_fallback_hours",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in patch) update[key] = patch[key];
  }
  if (typeof update.outreach_priority === "number") {
    update.outreach_priority = Math.min(
      10000,
      Math.max(1, Math.round(update.outreach_priority))
    );
  }
  if (typeof update.outreach_weight === "number") {
    update.outreach_weight = Math.min(
      20,
      Math.max(1, Math.round(update.outreach_weight))
    );
  }
  if (typeof update.daily_invite_limit === "number") {
    update.daily_invite_limit = clampDailyLimit(
      update.daily_invite_limit,
      DAILY_INVITE_LIMIT_MAX,
      20
    );
  }
  if (typeof update.daily_message_limit === "number") {
    update.daily_message_limit = clampDailyLimit(
      update.daily_message_limit,
      DAILY_MESSAGE_LIMIT_MAX,
      20
    );
  }
  if (typeof update.daily_react_limit === "number") {
    update.daily_react_limit = clampDailyLimit(
      update.daily_react_limit,
      DAILY_REACT_LIMIT_MAX,
      20
    );
  }
  if ("send_rules" in update) {
    update.send_rules = parseCampaignSendRules(update.send_rules);
  }
  if (typeof update.timezone === "string") {
    update.timezone = update.timezone.trim() || "Europe/London";
  }
  if ("stop_on_reply" in update) {
    update.stop_on_reply = update.stop_on_reply === true;
  }
  if ("manual_fallback_hours" in update) {
    update.manual_fallback_hours = parseManualFallbackHours(
      update.manual_fallback_hours
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
  steps: CampaignStepInput[],
  options?: { releaseWaitPosition?: number }
) {
  const releaseWaitPosition = options?.releaseWaitPosition;
  let oldSteps: Array<{ position: number; step_type: string; config?: unknown }> =
    [];
  if (releaseWaitPosition != null) {
    const { data } = await supabaseAdmin
      .from("linkedin_campaign_steps")
      .select("position, step_type, config")
      .eq("campaign_id", campaignId)
      .order("position", { ascending: true });
    oldSteps = data ?? [];
  }
  const cleaned = cleanCampaignStepsForSave(steps);

  const { data, error } = await supabaseAdmin.rpc(
    "replace_linkedin_campaign_steps",
    {
      p_campaign_id: campaignId,
      p_steps: cleaned,
    }
  );
  if (error) throw new Error(error.message);

  if (releaseWaitPosition != null) {
    const wait = oldSteps.find((s) => s.position === releaseWaitPosition);
    if (wait?.step_type === "wait") {
      await releaseLeadsAfterDeletedWait(
        campaignId,
        releaseWaitPosition,
        oldSteps
      );
    }
  }

  return data ?? [];
}

async function releaseLeadsAfterDeletedWait(
  campaignId: string,
  waitPosition: number,
  oldSteps: Array<{ position: number; step_type: string; config?: unknown }>
) {
  const { data: leads, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id, status, current_step_position, next_action_at")
    .eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);

  const nowIso = new Date().toISOString();
  const patches = patchesAfterDeletedWait({
    waitPosition,
    steps: oldSteps,
    leads: leads ?? [],
    nowIso,
  });
  const heldIds = patches
    .filter((patch) => patch.next_action_at)
    .map((patch) => patch.id);

  for (const patch of patches) {
    const { id, ...update } = patch;
    if (Object.keys(update).length === 0) continue;
    const { error: updateError } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update(update)
      .eq("id", id)
      .eq("campaign_id", campaignId);
    if (updateError) throw new Error(updateError.message);
  }

  if (heldIds.length === 0) return;
  const { error: jobError } = await supabaseAdmin
    .from("linkedin_send_jobs")
    .update({ scheduled_for: nowIso })
    .eq("campaign_id", campaignId)
    .in("lead_id", heldIds)
    .in("status", ["pending", "awaiting_coach"]);
  if (jobError) throw new Error(jobError.message);
}

export type LeadImportRow = {
  contact_id?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  title?: string | null;
  linkedin_provider_id?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  raw?: unknown;
};

type OwnedContact = {
  id: string;
  full_name: string;
  business_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  linkedin_provider_id: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
};

async function loadOwnedContactsForImport(
  coachId: string,
  contactIds: string[]
): Promise<Map<string, OwnedContact>> {
  const unique = [
    ...new Set(
      contactIds.filter((id) => typeof id === "string" && CONTACT_ID_RE.test(id))
    ),
  ].slice(0, 2500);
  const byId = new Map<string, OwnedContact>();
  if (!unique.length) return byId;

  const { data, error } = await selectContactsWithOptionalPhone<{
    id: string;
    full_name: string;
    business_name: string | null;
    job_title: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    linkedin_provider_id: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
  }>(
    async (columns) =>
      supabaseAdmin
        .from("contacts")
        .select(columns)
        .eq("coach_id", coachId)
        .in("id", unique),
    "id, full_name, business_name, job_title, email, linkedin_url",
    ["linkedin_provider_id", "instagram_url", "facebook_url"]
  );
  if (error) throw new Error(error.message ?? "Unable to load prospects.");

  for (const row of data) {
    byId.set(row.id, {
      id: row.id,
      full_name: row.full_name ?? "",
      business_name: row.business_name ?? null,
      job_title: row.job_title ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      linkedin_url: row.linkedin_url ?? null,
      linkedin_provider_id: row.linkedin_provider_id ?? null,
      instagram_url: row.instagram_url ?? null,
      facebook_url: row.facebook_url ?? null,
    });
  }
  return byId;
}

export async function addCampaignLeadsFromContacts(
  coachId: string,
  campaignId: string,
  contactIds: unknown[]
) {
  const ids = contactIds
    .filter((id): id is string => typeof id === "string" && CONTACT_ID_RE.test(id))
    .slice(0, 2500);
  if (!ids.length) return { added: 0, skipped: 0 };

  const owned = await loadOwnedContactsForImport(coachId, ids);
  const rows: LeadImportRow[] = [];
  let skipped = 0;
  for (const id of ids) {
    const contact = owned.get(id);
    if (!contact) {
      skipped += 1;
      continue;
    }
    const { first_name, last_name } = splitFullName(contact.full_name);
    rows.push({
      contact_id: contact.id,
      linkedin_url: contact.linkedin_url,
      linkedin_provider_id: contact.linkedin_provider_id,
      email: contact.email,
      phone: contact.phone,
      instagram_url: contact.instagram_url,
      facebook_url: contact.facebook_url,
      first_name,
      last_name,
      company: contact.business_name,
      title: contact.job_title,
    });
  }

  const result = await addCampaignLeads(coachId, campaignId, rows);
  return {
    added: result.added,
    skipped: result.skipped + skipped,
    blacklisted: result.blacklisted,
  };
}

type LeadInsertRow = {
  campaign_id: string;
  coach_id: string;
  contact_id: string | null;
  linkedin_url: string | null;
  linkedin_provider_id: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  status: "queued";
  current_step_position: number;
  next_action_at: string;
  metadata: Record<string, unknown>;
};

type PreparedLead = {
  insert: LeadInsertRow;
  email: string | null;
  needsContact: boolean;
};

/**
 * Enroll leads into a campaign basket. Fast path only: normalize what we
 * already have, dedupe in memory, batch-insert. No Unipile calls — the send
 * worker resolves provider IDs / vanity URLs lazily when a lead is due.
 */
export async function addCampaignLeads(
  coachId: string,
  campaignId: string,
  rows: LeadImportRow[]
) {
  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, channel, status, daily_invite_limit, timezone, send_rules")
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found.");

  const campaignChannel =
    (campaign.channel as string | undefined) === "email" ? "email" : "linkedin";

  const ownedContacts = await loadOwnedContactsForImport(
    coachId,
    rows
      .map((row) => row.contact_id)
      .filter((id): id is string => typeof id === "string")
  );

  const { loadBlacklistedEmails, loadBlacklistedLinkedInUrls } = await import(
    "@/lib/leadLists/audienceLists"
  );

  // Match pool import ceiling — never silently drop half a list.
  const limited = rows.slice(0, 2500);

  // Collect identity keys from the incoming batch so we only fetch matching
  // existing leads (not the whole campaign).
  const incomingUrls: string[] = [];
  const incomingProviders: string[] = [];
  const incomingContactIds: string[] = [];
  for (const row of limited) {
    const owned = row.contact_id ? ownedContacts.get(row.contact_id) : null;
    if (owned?.id) incomingContactIds.push(owned.id);
    const url = normalizeLinkedInProfileUrl(
      row.linkedin_url || owned?.linkedin_url || ""
    );
    if (url) incomingUrls.push(url);
    const provider =
      row.linkedin_provider_id || owned?.linkedin_provider_id || null;
    if (provider) incomingProviders.push(provider);
  }

  const uniqueUrls = [...new Set(incomingUrls)];
  const uniqueProviders = [...new Set(incomingProviders)];
  const uniqueContactIds = [...new Set(incomingContactIds)];

  const [blacklistedUrls, blacklistedEmails, existingByUrl, existingByProvider, existingByContact] =
    await Promise.all([
      loadBlacklistedLinkedInUrls(coachId),
      loadBlacklistedEmails(coachId),
      uniqueUrls.length
        ? supabaseAdmin
            .from("linkedin_campaign_leads")
            .select("linkedin_url")
            .eq("campaign_id", campaignId)
            .in("linkedin_url", uniqueUrls)
        : Promise.resolve({ data: [] as { linkedin_url: string | null }[], error: null }),
      uniqueProviders.length
        ? supabaseAdmin
            .from("linkedin_campaign_leads")
            .select("linkedin_provider_id")
            .eq("campaign_id", campaignId)
            .in("linkedin_provider_id", uniqueProviders)
        : Promise.resolve({
            data: [] as { linkedin_provider_id: string | null }[],
            error: null,
          }),
      uniqueContactIds.length
        ? supabaseAdmin
            .from("linkedin_campaign_leads")
            .select("contact_id")
            .eq("campaign_id", campaignId)
            .in("contact_id", uniqueContactIds)
        : Promise.resolve({
            data: [] as { contact_id: string | null }[],
            error: null,
          }),
    ]);

  if (existingByUrl.error) throw new Error(existingByUrl.error.message);
  if (existingByProvider.error) {
    throw new Error(existingByProvider.error.message);
  }
  if (existingByContact.error) {
    throw new Error(existingByContact.error.message);
  }

  const existingUrls = new Set<string>();
  const existingProviders = new Set<string>();
  const existingContactIds = new Set<string>();
  for (const row of existingByUrl.data ?? []) {
    const url = normalizeLinkedInProfileUrl(String(row.linkedin_url ?? ""));
    if (url) existingUrls.add(url);
  }
  for (const row of existingByProvider.data ?? []) {
    if (row.linkedin_provider_id) {
      existingProviders.add(String(row.linkedin_provider_id));
    }
  }
  for (const row of existingByContact.data ?? []) {
    if (row.contact_id) existingContactIds.add(String(row.contact_id));
  }

  const nowIso = new Date().toISOString();
  const prepared: PreparedLead[] = [];
  let skipped = 0;
  let blacklisted = 0;

  for (const row of limited) {
    const owned = row.contact_id ? ownedContacts.get(row.contact_id) : null;
    if (row.contact_id && !owned) {
      skipped += 1;
      continue;
    }
    if (owned && existingContactIds.has(owned.id)) {
      skipped += 1;
      continue;
    }

    const email = normalizePoolEmail(row.email || owned?.email || "");
    const phone = normalizePoolPhone(row.phone || owned?.phone || "");
    const socials = mergeSocialUrls(
      {
        instagram_url: normalizeInstagramProfileUrl(
          row.instagram_url || owned?.instagram_url
        ),
        facebook_url: normalizeFacebookProfileUrl(
          row.facebook_url || owned?.facebook_url
        ),
      },
      socialUrlsFromUnknown(row.raw)
    );

    if (campaignChannel === "email") {
      if (!email) {
        skipped += 1;
        continue;
      }
      if (blacklistedEmails.has(email)) {
        skipped += 1;
        blacklisted += 1;
        continue;
      }

      const url = normalizeLinkedInProfileUrl(
        row.linkedin_url || owned?.linkedin_url || ""
      );
      if (url && blacklistedUrls.has(url)) {
        skipped += 1;
        blacklisted += 1;
        continue;
      }
      if (url && existingUrls.has(url)) {
        skipped += 1;
        continue;
      }
      if (url) existingUrls.add(url);

      const providerId =
        row.linkedin_provider_id || owned?.linkedin_provider_id || null;
      if (providerId && existingProviders.has(providerId)) {
        skipped += 1;
        continue;
      }
      if (providerId) existingProviders.add(providerId);

      prepared.push({
        email,
        needsContact: !owned?.id,
        insert: {
          campaign_id: campaignId,
          coach_id: coachId,
          contact_id: owned?.id ?? null,
          linkedin_url: url,
          linkedin_provider_id: providerId,
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
          company: row.company ?? null,
          title: row.title ?? null,
          status: "queued",
          current_step_position: 0,
          next_action_at: nowIso,
          metadata: {
            email,
            ...(phone ? { phone } : {}),
            ...(socials.instagram_url
              ? { instagram_url: socials.instagram_url }
              : {}),
            ...(socials.facebook_url
              ? { facebook_url: socials.facebook_url }
              : {}),
          },
        },
      });
      continue;
    }

    const url = normalizeLinkedInProfileUrl(
      row.linkedin_url || owned?.linkedin_url || ""
    );
    const incomingProvider =
      row.linkedin_provider_id || owned?.linkedin_provider_id || null;
    const pair = parseLinkedInIdentity({
      linkedinUrl: url,
      providerId: incomingProvider,
    });
    const providerId = pair.providerId || incomingProvider || null;
    const resolvedUrl = pair.linkedinUrl || url || null;
    if (!resolvedUrl && !providerId) {
      skipped += 1;
      continue;
    }

    if (resolvedUrl) {
      const blockedUrl =
        normalizeLinkedInProfileUrl(resolvedUrl) || resolvedUrl;
      if (blacklistedUrls.has(blockedUrl)) {
        skipped += 1;
        blacklisted += 1;
        continue;
      }
      if (existingUrls.has(resolvedUrl)) {
        skipped += 1;
        continue;
      }
    }
    if (providerId && existingProviders.has(providerId)) {
      skipped += 1;
      continue;
    }

    if (resolvedUrl) existingUrls.add(resolvedUrl);
    if (providerId) existingProviders.add(providerId);

    const providerHint =
      pair.publicIdentifier ||
      (resolvedUrl ? linkedInPublicIdentifier(resolvedUrl) : null);

    prepared.push({
      email,
      // Link existing CRM rows when we already have an email; create only for
      // email-channel campaigns. Hybrid LinkedIn→email can attach contacts later.
      needsContact: false,
      insert: {
        campaign_id: campaignId,
        coach_id: coachId,
        contact_id: owned?.id ?? null,
        linkedin_url: resolvedUrl,
        linkedin_provider_id: providerId,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        company: row.company ?? null,
        title: row.title ?? null,
        status: "queued",
        current_step_position: 0,
        next_action_at: nowIso,
        metadata: {
          ...(providerHint ? { public_identifier: providerHint } : {}),
          ...(email ? { email } : {}),
          ...(socials.instagram_url
            ? { instagram_url: socials.instagram_url }
            : {}),
          ...(socials.facebook_url
            ? { facebook_url: socials.facebook_url }
            : {}),
        },
      },
    });
  }

  // Attach existing contacts by email (one query). Create missing contacts only
  // for email campaigns — LinkedIn basket enrollment should not block on CRM.
  const emailsNeedingContact = [
    ...new Set(
      prepared
        .filter((row) => row.needsContact && row.email && !row.insert.contact_id)
        .map((row) => row.email as string)
    ),
  ];
  const emailsToLink = [
    ...new Set(
      prepared
        .filter((row) => !row.insert.contact_id && row.email)
        .map((row) => row.email as string)
    ),
  ];

  const contactByEmail = new Map<string, string>();
  if (emailsToLink.length) {
    const { data: existingContacts, error: contactLookupError } =
      await supabaseAdmin
        .from("contacts")
        .select("id, email")
        .eq("coach_id", coachId)
        .in("email", emailsToLink);
    if (contactLookupError) throw new Error(contactLookupError.message);
    for (const contact of existingContacts ?? []) {
      const normalized = normalizePoolEmail(
        typeof contact.email === "string" ? contact.email : null
      );
      if (normalized && contact.id) contactByEmail.set(normalized, contact.id);
    }
  }

  const toCreate = emailsNeedingContact.filter(
    (email) => !contactByEmail.has(email)
  );
  if (toCreate.length) {
    const byEmail = new Map<string, PreparedLead>();
    for (const row of prepared) {
      if (row.email && toCreate.includes(row.email) && !byEmail.has(row.email)) {
        byEmail.set(row.email, row);
      }
    }
    const payloads = [...byEmail.entries()].map(([email, row]) => ({
      coach_id: coachId,
      type: "prospect" as const,
      prospect_source: "campaign_import",
      prospect_status: "leads",
      email,
      full_name:
        [row.insert.first_name, row.insert.last_name].filter(Boolean).join(" ") ||
        email,
      first_name: row.insert.first_name,
      last_name: row.insert.last_name,
      business_name: row.insert.company,
      job_title: row.insert.title,
      linkedin_url: row.insert.linkedin_url,
      linkedin_provider_id: row.insert.linkedin_provider_id,
    }));

    for (let i = 0; i < payloads.length; i += 100) {
      const chunk = payloads.slice(i, i + 100);
      const { data: created, error: createError } = await supabaseAdmin
        .from("contacts")
        .insert(chunk)
        .select("id, email");
      if (createError) {
        // Fall back to per-row insert so one bad row doesn't block the batch.
        for (const payload of chunk) {
          const { data: one, error: oneError } = await supabaseAdmin
            .from("contacts")
            .insert(payload)
            .select("id, email")
            .maybeSingle();
          if (oneError || !one?.id) continue;
          const normalized = normalizePoolEmail(
            typeof one.email === "string" ? one.email : payload.email
          );
          if (normalized) contactByEmail.set(normalized, one.id);
        }
        continue;
      }
      for (const contact of created ?? []) {
        const normalized = normalizePoolEmail(
          typeof contact.email === "string" ? contact.email : null
        );
        if (normalized && contact.id) contactByEmail.set(normalized, contact.id);
      }
    }
  }

  const inserts: LeadInsertRow[] = [];
  for (const row of prepared) {
    if (!row.insert.contact_id && row.email) {
      const linked = contactByEmail.get(row.email);
      if (linked) {
        if (existingContactIds.has(linked)) {
          skipped += 1;
          continue;
        }
        row.insert.contact_id = linked;
        existingContactIds.add(linked);
      }
    }
    if (campaignChannel === "email" && !row.insert.contact_id) {
      skipped += 1;
      continue;
    }
    inserts.push(row.insert);
  }

  let added = 0;
  const addedIds: string[] = [];
  for (let i = 0; i < inserts.length; i += 100) {
    const chunk = inserts.slice(i, i + 100);
    const { data, error } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .insert(chunk)
      .select("id");
    if (error) {
      // Unique races / partial failures: try one-by-one so good rows still land.
      for (const lead of chunk) {
        const { data: one, error: oneError } = await supabaseAdmin
          .from("linkedin_campaign_leads")
          .insert(lead)
          .select("id")
          .maybeSingle();
        if (oneError || !one?.id) skipped += 1;
        else {
          added += 1;
          addedIds.push(one.id);
        }
      }
      continue;
    }
    added += data?.length ?? chunk.length;
    for (const row of data ?? []) {
      if (row.id) addedIds.push(row.id);
    }
  }

  // Pace queued leads across send days at the daily invite limit so the UI
  // does not show every connection request as "Due now".
  if (added > 0) {
    await restaggerQueuedLeadTimes(coachId, campaignId, {
      dailyInviteLimit:
        typeof campaign.daily_invite_limit === "number"
          ? campaign.daily_invite_limit
          : 20,
      timezone: (campaign.timezone as string | null) ?? null,
      sendRules: campaign.send_rules,
    });
  }

  if (campaign.status === "running" && addedIds.length > 0) {
    await enqueuePendingJobsForCampaign(coachId, campaignId, addedIds);
  }

  return { added, skipped, blacklisted };
}

/**
 * Assign next_action_at for all queued leads using the campaign daily limit
 * (Mon–Fri send window). Keeps the prospects table / sequence hopper honest.
 */
async function restaggerQueuedLeadTimes(
  coachId: string,
  campaignId: string,
  opts: {
    dailyInviteLimit: number;
    timezone: string | null;
    sendRules: unknown;
  }
) {
  const { data: queued, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("coach_id", coachId)
    .eq("status", "queued")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!queued?.length) return;

  const times = staggerInviteActionTimes({
    count: queued.length,
    dailyLimit: opts.dailyInviteLimit,
    timezone: opts.timezone,
    sendRules: opts.sendRules,
    usedToday: 0,
  });

  for (let i = 0; i < queued.length; i += 50) {
    const slice = queued.slice(i, i + 50);
    await Promise.all(
      slice.map((lead, offset) => {
        const at = times[i + offset];
        if (!lead.id || !at) return Promise.resolve();
        return supabaseAdmin
          .from("linkedin_campaign_leads")
          .update({ next_action_at: at.toISOString() })
          .eq("id", lead.id)
          .eq("campaign_id", campaignId);
      })
    );
  }
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

const PAUSABLE_LEAD_STATUSES = new Set([
  "queued",
  "invited",
  "connected",
  "in_sequence",
]);

const MAX_LEAD_BATCH = 100;

function asLeadIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !CONTACT_ID_RE.test(item)) continue;
    if (!ids.includes(item)) ids.push(item);
    if (ids.length >= MAX_LEAD_BATCH) break;
  }
  return ids;
}

function appendLeadFunnelEvent(
  existing: unknown,
  event: { type: string; meta?: Record<string, unknown> }
) {
  const list = Array.isArray(existing) ? [...existing] : [];
  list.push({
    type: event.type,
    at: new Date().toISOString(),
    ...(event.meta ? { meta: event.meta } : {}),
  });
  return list.slice(-40);
}

function pausedFromStatus(events: unknown): string | null {
  if (!Array.isArray(events)) return null;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event || typeof event !== "object") continue;
    const row = event as { type?: unknown; meta?: { from?: unknown } };
    if (row.type !== "sequence_paused") continue;
    return typeof row.meta?.from === "string" ? row.meta.from : null;
  }
  return null;
}

export async function deleteCampaignLeads(
  coachId: string,
  campaignId: string,
  leadIds: unknown
) {
  const ids = asLeadIds(leadIds);
  if (!ids.length) return { deleted: 0 };
  const { error, count } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .delete({ count: "exact" })
    .in("id", ids)
    .eq("campaign_id", campaignId)
    .eq("coach_id", coachId);
  if (error) throw new Error(error.message);
  return { deleted: count ?? ids.length };
}

export async function pauseCampaignLeads(
  coachId: string,
  campaignId: string,
  leadIds: unknown
) {
  const ids = asLeadIds(leadIds);
  if (!ids.length) return { updated: 0 };
  const { data: leads, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id, status, funnel_events")
    .in("id", ids)
    .eq("campaign_id", campaignId)
    .eq("coach_id", coachId);
  if (error) throw new Error(error.message);

  const { cancelOpenSendJobs } = await import("@/lib/unipile/remindQueue");
  let updated = 0;
  for (const lead of leads ?? []) {
    const status = String(lead.status || "");
    if (!PAUSABLE_LEAD_STATUSES.has(status)) continue;
    const { error: upErr } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({
        status: "paused",
        funnel_events: appendLeadFunnelEvent(lead.funnel_events, {
          type: "sequence_paused",
          meta: { from: status },
        }),
      })
      .eq("id", lead.id);
    if (upErr) throw new Error(upErr.message);
    await cancelOpenSendJobs(lead.id as string, "Lead paused");
    updated += 1;
  }
  return { updated };
}

export async function resumeCampaignLeads(
  coachId: string,
  campaignId: string,
  leadIds: unknown
) {
  const ids = asLeadIds(leadIds);
  if (!ids.length) return { updated: 0 };
  const { data: leads, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id, status, current_step_position, funnel_events")
    .in("id", ids)
    .eq("campaign_id", campaignId)
    .eq("coach_id", coachId);
  if (error) throw new Error(error.message);

  let updated = 0;
  for (const lead of leads ?? []) {
    if (String(lead.status || "") !== "paused") continue;
    const from = pausedFromStatus(lead.funnel_events);
    const nextStatus =
      from && PAUSABLE_LEAD_STATUSES.has(from)
        ? from
        : Number(lead.current_step_position ?? 0) > 0
          ? "in_sequence"
          : "queued";
    const { error: upErr } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({
        status: nextStatus,
        funnel_events: appendLeadFunnelEvent(lead.funnel_events, {
          type: "sequence_resumed",
          meta: { to: nextStatus },
        }),
      })
      .eq("id", lead.id);
    if (upErr) throw new Error(upErr.message);
    updated += 1;
  }
  if (updated > 0) {
    const { data: campaign } = await supabaseAdmin
      .from("linkedin_campaigns")
      .select("status")
      .eq("id", campaignId)
      .eq("coach_id", coachId)
      .maybeSingle();
    if (campaign?.status === "running") {
      await enqueuePendingJobsForCampaign(coachId, campaignId);
    }
  }
  return { updated };
}

export async function moveCampaignLeads(
  coachId: string,
  campaignId: string,
  leadIds: unknown,
  targetCampaignId: string
) {
  if (!CONTACT_ID_RE.test(targetCampaignId) || targetCampaignId === campaignId) {
    throw new Error("Pick a different campaign.");
  }
  const ids = asLeadIds(leadIds);
  if (!ids.length) return { moved: 0 };
  const { data: leads, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select(
      "id, contact_id, linkedin_url, linkedin_provider_id, first_name, last_name, company, title"
    )
    .in("id", ids)
    .eq("campaign_id", campaignId)
    .eq("coach_id", coachId);
  if (error) throw new Error(error.message);

  const { enrollLeadInOtherCampaign } = await import(
    "@/lib/unipile/sequenceAdvance"
  );
  let moved = 0;
  for (const lead of leads ?? []) {
    await enrollLeadInOtherCampaign({
      coachId,
      sourceCampaignId: campaignId,
      targetCampaignId,
      lead,
    });
    await deleteCampaignLead(coachId, campaignId, lead.id as string);
    moved += 1;
  }
  return { moved };
}

/**
 * Hard-delete. AuthZ is coach_id on the row (same as update/archive). Missing
 * or foreign campaigns return false so the route can 404 without an existence
 * oracle. Steps, leads, and send jobs cascade in the DB; conversations and
 * contacts are not campaign-owned and stay. Cancel open jobs first so the
 * worker cannot pick a row mid-delete.
 */
export async function deleteCampaign(coachId: string, campaignId: string) {
  const owned = await campaignOwnedByCoach(coachId, campaignId);
  if (!owned) return false;

  const { cancelOpenSendJobsForCampaign } = await import(
    "@/lib/unipile/remindQueue"
  );
  await cancelOpenSendJobsForCampaign(coachId, campaignId, "Campaign deleted");

  const { error, count } = await supabaseAdmin
    .from("linkedin_campaigns")
    .delete({ count: "exact" })
    .eq("id", campaignId)
    .eq("coach_id", coachId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
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
  if (status === "paused" || status === "archived") {
    const { cancelOpenSendJobsForCampaign } = await import(
      "@/lib/unipile/remindQueue"
    );
    await cancelOpenSendJobsForCampaign(
      coachId,
      campaignId,
      status === "archived" ? "Campaign archived" : "Campaign paused"
    );
  }
  return data;
}

export async function enqueuePendingJobsForCampaign(
  coachId: string,
  campaignId: string,
  /** When set, only enqueue for these leads (e.g. freshly added). */
  leadIds?: string[]
) {
  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("timezone, send_rules, daily_invite_limit")
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();

  // Re-pace any queued leads that were enrolled before stagger existed.
  await restaggerQueuedLeadTimes(coachId, campaignId, {
    dailyInviteLimit:
      typeof campaign?.daily_invite_limit === "number"
        ? campaign.daily_invite_limit
        : 20,
    timezone: (campaign?.timezone as string | null) ?? null,
    sendRules: campaign?.send_rules,
  });

  const { jobStatusForStep } = await import("@/lib/unipile/remindQueue");
  const { data: steps } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true });
  if (!steps?.length) return { enqueued: 0 };

  let leadsQuery = supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("coach_id", coachId)
    .in("status", ["queued", "invited", "connected", "in_sequence"]);
  if (leadIds?.length) {
    leadsQuery = leadsQuery.in("id", leadIds.slice(0, 2500));
  }
  const { data: leads } = await leadsQuery;

  const sendRules = parseCampaignSendRules(campaign?.send_rules);
  const timezone =
    (campaign?.timezone as string | null)?.trim() || "Europe/London";

  const { consumeNonOutboundSteps } = await import(
    "@/lib/unipile/sequenceAdvance"
  );

  let enqueued = 0;
  for (const lead of leads ?? []) {
    let position = Number(lead.current_step_position ?? 0);
    let desired =
      lead.next_action_at && new Date(lead.next_action_at) > new Date()
        ? new Date(lead.next_action_at)
        : new Date();
    let step = steps.find((s) => s.position === position);
    if (!step) continue;

    if (!campaignStepCreatesJob(String(step.step_type), step.config)) {
      const consumed = await consumeNonOutboundSteps({
        steps: steps as Array<{
          id?: string;
          position: number;
          step_type: string;
          wait_hours?: number | null;
          config?: unknown;
        }>,
        lead,
        campaignId,
        coachId,
        startPosition: position,
      });
      await supabaseAdmin
        .from("linkedin_campaign_leads")
        .update({
          current_step_position: consumed.position,
          next_action_at: consumed.completed
            ? null
            : consumed.nextAction.toISOString(),
          ...(consumed.completed ? { status: "completed" } : {}),
        })
        .eq("id", lead.id);
      if (consumed.completed) continue;
      position = consumed.position;
      desired = consumed.nextAction;
      step = steps.find((s) => s.position === position);
      if (
        !step ||
        !campaignStepCreatesJob(String(step.step_type), step.config)
      )
        continue;
    }

    const { data: existing } = await supabaseAdmin
      .from("linkedin_send_jobs")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("step_id", step.id)
      .in("status", ["pending", "running", "awaiting_coach"])
      .maybeSingle();
    if (existing) continue;

    const scheduled = nextCampaignSendAt({
      now: desired,
      timezone,
      rules: sendRules,
    }).toISOString();

    const status = jobStatusForStep(
      step.step_type === "message" ? (step.send_mode as string | null) : "auto",
      String(step.step_type)
    );

    const { error } = await supabaseAdmin.from("linkedin_send_jobs").insert({
      coach_id: coachId,
      campaign_id: campaignId,
      lead_id: lead.id,
      step_id: step.id,
      scheduled_for: scheduled,
      status,
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
  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found.");
  await supabaseAdmin
    .from("linkedin_campaigns")
    .update({
      channel: playbook.channel,
      ...(playbook.dailyInviteLimit
        ? { daily_invite_limit: playbook.dailyInviteLimit }
        : {}),
    })
    .eq("id", campaignId)
    .eq("coach_id", coachId);
  const steps = await replaceCampaignSteps(
    campaignId,
    playbook.steps.map((s, i) => ({ ...s, position: i }))
  );
  return { playbook: { id: playbook.id, name: playbook.name }, steps };
}

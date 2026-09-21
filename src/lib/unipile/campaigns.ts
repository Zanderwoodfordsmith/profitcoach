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
  campaignStepAllowsVariants,
  campaignStepCreatesJob,
  campaignStepStoresBody,
  isCampaignStepType,
  sanitizeStepConfig,
  sanitizeMessageMediaPatch,
  type CampaignStepMedia,
  type CampaignStepMediaKind,
  type CampaignStepType,
} from "@/lib/unipile/campaignStepTypes";
import { clampWaitHours } from "@/lib/unipile/waitDuration";
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
} from "@/lib/unipile/campaignSendWindow";
import {
  classifyLeadReply,
  emptyReplyCounts,
} from "@/lib/unipile/interest";

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
        .limit(500),
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
    template_id?: string | null;
  }
) {
  const { getCampaignCreateTemplate } = await import(
    "@/lib/unipile/campaignCreateTemplates"
  );
  const template = getCampaignCreateTemplate(input.template_id);
  const name = input.name.trim() || template?.name || "Untitled campaign";
  const channel =
    template?.channel ?? (input.channel === "email" ? "email" : "linkedin");
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
  if (template && data?.id && template.steps.length > 0) {
    await replaceCampaignSteps(
      data.id,
      template.steps.map((s, i) => ({ ...s, position: i }))
    );
  } else if (channel === "email" && data?.id) {
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
  const cleaned = steps
    .map((s, i) => {
      const sendMode =
        s.step_type === "message" && s.send_mode === "remind"
          ? "remind"
          : "auto";
      const fallbackHours =
        sendMode === "remind" && s.fallback_hours != null
          ? Math.max(1, Math.min(720, Number(s.fallback_hours)))
          : null;
      return {
        campaign_id: campaignId,
        position: i,
        step_type: s.step_type,
        body: campaignStepStoresBody(s.step_type)
          ? (s.body ?? "").slice(0, 16000)
          : null,
        wait_hours:
          s.step_type === "wait"
            ? clampWaitHours(Number(s.wait_hours ?? 24))
            : null,
        variants:
          campaignStepAllowsVariants(s.step_type) &&
          Array.isArray(s.variants) &&
          s.variants.length
            ? s.variants
                .filter((v) => v?.key)
                .map((v) => {
                  const media = sanitizeMessageMediaPatch({
                    media_kind: v.media_kind,
                    media: v.media,
                  });
                  return {
                    key: String(v.key).slice(0, 32),
                    label: v.label ? String(v.label).slice(0, 120) : undefined,
                    body: String(v.body ?? "").slice(0, 16000),
                    media_kind: media.media_kind,
                    media: media.media,
                  };
                })
            : [],
        send_mode: sendMode,
        fallback_hours: fallbackHours,
        fallback_body:
          sendMode === "remind" && s.fallback_body
            ? String(s.fallback_body).slice(0, 16000)
            : null,
        config: sanitizeStepConfig(s.step_type, s.config),
      };
    })
    .filter((s) => isCampaignStepType(s.step_type));

  const { error: delErr } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .delete()
    .eq("campaign_id", campaignId);
  if (delErr) throw new Error(delErr.message);

  async function maybeRelease() {
    if (releaseWaitPosition == null) return;
    const wait = oldSteps.find((s) => s.position === releaseWaitPosition);
    if (wait?.step_type !== "wait") return;
    await releaseLeadsAfterDeletedWait(
      campaignId,
      releaseWaitPosition,
      oldSteps
    );
  }

  if (cleaned.length === 0) {
    await maybeRelease();
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .insert(cleaned)
    .select("*")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  await maybeRelease();
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
  ].slice(0, 500);
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
    .slice(0, 500);
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

export async function addCampaignLeads(
  coachId: string,
  campaignId: string,
  rows: LeadImportRow[]
) {
  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, outreach_account_id, channel")
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found.");

  const campaignChannel =
    (campaign.channel as string | undefined) === "email" ? "email" : "linkedin";

  let unipileAccountId: string | null = null;
  if (campaign.outreach_account_id) {
    const { data: account } = await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .select("unipile_account_id")
      .eq("id", campaign.outreach_account_id)
      .maybeSingle();
    unipileAccountId = (account?.unipile_account_id as string | null) ?? null;
  }
  if (!unipileAccountId) {
    const { data: fallback } = await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .select("unipile_account_id")
      .eq("coach_id", coachId)
      .eq("status", "OK")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    unipileAccountId = (fallback?.unipile_account_id as string | null) ?? null;
  }

  const {
    linkedInIdentityIncomplete,
    parseLinkedInIdentity,
    preferLinkedInUrl,
    resolveLinkedInIdentityPair,
  } = await import("@/lib/contacts/linkedinIdentity");
  const { resolveOrCreateContact } = await import(
    "@/lib/contacts/resolveOrCreateContact"
  );
  const { normalizePoolEmail, normalizePoolPhone } = await import(
    "@/lib/pool/identity"
  );

  const ownedContacts = await loadOwnedContactsForImport(
    coachId,
    rows
      .map((row) => row.contact_id)
      .filter((id): id is string => typeof id === "string")
  );

  const { loadBlacklistedEmails, loadBlacklistedLinkedInUrls } = await import(
    "@/lib/leadLists/audienceLists"
  );
  const [blacklistedUrls, blacklistedEmails] = await Promise.all([
    loadBlacklistedLinkedInUrls(coachId),
    loadBlacklistedEmails(coachId),
  ]);

  let added = 0;
  let skipped = 0;
  let blacklisted = 0;
  for (const row of rows.slice(0, 500)) {
    const owned = row.contact_id ? ownedContacts.get(row.contact_id) : null;
    if (row.contact_id && !owned) {
      skipped += 1;
      continue;
    }

    if (owned) {
      const { data: existingByContact } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("contact_id", owned.id)
        .maybeSingle();
      if (existingByContact?.id) {
        skipped += 1;
        continue;
      }
    }

    const email = normalizePoolEmail(row.email || owned?.email || "");
    const phone = normalizePoolPhone(row.phone || owned?.phone || "");

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

      let contactId: string | null = owned?.id ?? null;
      if (!contactId) {
        const resolved = await resolveOrCreateContact({
          coachId,
          email,
          phone,
          linkedinUrl: row.linkedin_url || null,
          linkedinProviderId: row.linkedin_provider_id || null,
          firstName: row.first_name,
          lastName: row.last_name,
          fullName:
            [row.first_name, row.last_name].filter(Boolean).join(" ") || null,
          businessName: row.company,
          jobTitle: row.title,
          type: "prospect",
          prospectSource: "campaign_import",
          unipileAccountId,
        });
        contactId = resolved.contactId;
      }

      const { data: existingByContact } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("contact_id", contactId)
        .maybeSingle();
      if (existingByContact?.id) {
        skipped += 1;
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

      const { error } = await supabaseAdmin.from("linkedin_campaign_leads").insert({
        campaign_id: campaignId,
        coach_id: coachId,
        contact_id: contactId,
        linkedin_url: url,
        linkedin_provider_id:
          row.linkedin_provider_id || owned?.linkedin_provider_id || null,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        company: row.company ?? null,
        title: row.title ?? null,
        status: "queued",
        current_step_position: 0,
        next_action_at: new Date().toISOString(),
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
      });
      if (error) {
        skipped += 1;
        continue;
      }
      added += 1;
      continue;
    }

    const url = normalizeLinkedInProfileUrl(
      row.linkedin_url || owned?.linkedin_url || ""
    );
    const incomingProvider =
      row.linkedin_provider_id || owned?.linkedin_provider_id || null;
    if (!url && !incomingProvider) {
      skipped += 1;
      continue;
    }

    let pair = parseLinkedInIdentity({
      linkedinUrl: url,
      providerId: incomingProvider,
    });
    if (
      linkedInIdentityIncomplete(pair) &&
      unipileAccountId &&
      (pair.providerId || pair.linkedinUrl)
    ) {
      pair = await resolveLinkedInIdentityPair({
        linkedinUrl: pair.linkedinUrl,
        providerId: pair.providerId,
        publicIdentifier: pair.publicIdentifier,
        unipileAccountId,
      });
    }

    const resolvedUrl =
      preferLinkedInUrl(url, pair.linkedinUrl) || pair.linkedinUrl || url;
    if (!resolvedUrl) {
      skipped += 1;
      continue;
    }
    const blockedUrl = normalizeLinkedInProfileUrl(resolvedUrl) || resolvedUrl;
    if (blacklistedUrls.has(blockedUrl)) {
      skipped += 1;
      blacklisted += 1;
      continue;
    }
    const providerId = pair.providerId || incomingProvider || null;
    const providerHint =
      pair.publicIdentifier || linkedInPublicIdentifier(resolvedUrl);

    // Skip if this campaign already has the same person (URL or provider id).
    if (providerId) {
      const { data: existingByProvider } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("linkedin_provider_id", providerId)
        .maybeSingle();
      if (existingByProvider?.id) {
        skipped += 1;
        continue;
      }
    }
    {
      const { data: existingByUrl } = await supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("linkedin_url", resolvedUrl)
        .maybeSingle();
      if (existingByUrl?.id) {
        skipped += 1;
        continue;
      }
    }

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

    let contactId: string | null = owned?.id ?? null;
    // Link or create a contact when email is present so hybrid email steps work.
    if (!contactId && email) {
      try {
        const resolved = await resolveOrCreateContact({
          coachId,
          email,
          phone,
          linkedinUrl: resolvedUrl,
          linkedinProviderId: providerId,
          firstName: row.first_name,
          lastName: row.last_name,
          fullName:
            [row.first_name, row.last_name].filter(Boolean).join(" ") || null,
          businessName: row.company,
          jobTitle: row.title,
          type: "prospect",
          prospectSource: "campaign_import",
          unipileAccountId,
        });
        contactId = resolved.contactId;
      } catch {
        // LinkedIn enrollment should not fail if CRM write fails.
      }
    }

    const { error } = await supabaseAdmin.from("linkedin_campaign_leads").insert({
      campaign_id: campaignId,
      coach_id: coachId,
      contact_id: contactId,
      linkedin_url: resolvedUrl,
      linkedin_provider_id: providerId,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      company: row.company ?? null,
      title: row.title ?? null,
      status: "queued",
      current_step_position: 0,
      next_action_at: new Date().toISOString(),
      metadata: {
        ...(providerHint ? { public_identifier: providerHint } : {}),
        ...(email ? { email } : {}),
        ...(socials.instagram_url ? { instagram_url: socials.instagram_url } : {}),
        ...(socials.facebook_url ? { facebook_url: socials.facebook_url } : {}),
      },
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

  return { added, skipped, blacklisted };
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
  campaignId: string
) {
  const { jobStatusForStep } = await import("@/lib/unipile/remindQueue");
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

  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("timezone, send_rules")
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
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

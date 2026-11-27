import {
  createCoachTemplate,
  deleteLibraryItem,
  getLibraryItem,
  listCoachOwnTemplates,
  listLibraryItems,
  updateLibraryItem,
} from "@/lib/campaignLibrary/store";
import {
  liveStepsFromLibrary,
  isLibraryItemId,
  publishedTemplateError,
} from "@/lib/campaignLibrary/instantiateCore";
import {
  toCoachCampaignTemplate,
  type CampaignLibraryKind,
  type CampaignLibraryItemDetail,
  type CampaignLibraryTemplateSettings,
  type CoachCampaignTemplate,
} from "@/lib/campaignLibrary/types";
import {
  campaignChannelFrom,
  campaignOwnedByCoach,
  createCampaign,
  replaceCampaignSteps,
  updateCampaign,
  type CampaignStepInput,
} from "@/lib/unipile/campaigns";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export {
  isLibraryItemId,
  liveStepsFromLibrary,
  publishedTemplateError,
} from "@/lib/campaignLibrary/instantiateCore";

function settingsPatch(
  settings: CampaignLibraryTemplateSettings | { manual_fallback_hours?: number | null }
): Record<string, unknown> {
  if (!("daily_invite_limit" in settings)) return {};
  return {
    stop_on_reply: settings.stop_on_reply,
    daily_invite_limit: settings.daily_invite_limit,
    daily_message_limit: settings.daily_message_limit,
    daily_react_limit: settings.daily_react_limit,
    timezone: settings.timezone,
    send_rules: settings.send_rules,
    manual_fallback_hours: settings.manual_fallback_hours,
  };
}

/** The coach's own templates first, then BCA's published ones. */
export async function listCoachCampaignTemplates(
  coachId: string | null
): Promise<CoachCampaignTemplate[]> {
  const [own, bca] = await Promise.all([
    coachId ? listCoachOwnTemplates(coachId) : Promise.resolve([]),
    listLibraryItems({ itemType: "template", status: "published" }),
  ]);
  return [...own, ...bca].map(toCoachCampaignTemplate);
}

export async function getPublishedLibraryTemplate(
  id: string,
  coachId: string
): Promise<CampaignLibraryItemDetail> {
  if (!isLibraryItemId(id)) {
    throw new Error("Template not found.");
  }
  const item = await getLibraryItem(id.trim());
  const error = publishedTemplateError(item, coachId);
  if (error || !item) throw new Error(error ?? "Template not found.");
  return item;
}

/** A campaign that opens with an invite is a Connection one; the rest nurture. */
function kindFromSteps(steps: Array<{ step_type: string }>): CampaignLibraryKind {
  return steps.some((step) => step.step_type === "invite") ? "connector" : "nurture";
}

/**
 * Copy one of the coach's campaigns (steps and sending settings, no leads)
 * into a template only they see. Links to other campaigns are dropped.
 */
export async function saveCampaignAsTemplate(
  coachId: string,
  campaignId: string,
  name: string
): Promise<CoachCampaignTemplate> {
  const { data: campaign, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select(
      "id, name, channel, stop_on_reply, daily_invite_limit, daily_message_limit, daily_react_limit, timezone, send_rules, manual_fallback_hours"
    )
    .eq("id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!campaign) throw new Error("Campaign not found.");

  const { data: stepRows, error: stepsError } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select(
      "position, step_type, body, wait_hours, variants, send_mode, fallback_hours, fallback_body, config"
    )
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true });
  if (stepsError) throw new Error(stepsError.message);
  const steps = (stepRows ?? []) as CampaignStepInput[];
  if (steps.length === 0) {
    throw new Error("Add a step before saving this as a template.");
  }

  const saved = await createCoachTemplate({
    coachId,
    name: name.trim() || String(campaign.name ?? ""),
    kind: kindFromSteps(steps),
    channel: campaignChannelFrom(campaign.channel ?? undefined),
    settings: campaign,
    steps,
  });
  return toCoachCampaignTemplate(saved);
}

async function ownTemplate(coachId: string, id: string) {
  if (!isLibraryItemId(id)) return null;
  const item = await getLibraryItem(id.trim());
  return item && item.coach_id === coachId ? item : null;
}

export async function renameCoachTemplate(
  coachId: string,
  id: string,
  name: string
): Promise<CoachCampaignTemplate | null> {
  const item = await ownTemplate(coachId, id);
  if (!item) return null;
  const updated = await updateLibraryItem(item.id, { name });
  return updated ? toCoachCampaignTemplate(updated) : null;
}

export async function deleteCoachTemplate(
  coachId: string,
  id: string
): Promise<boolean> {
  const item = await ownTemplate(coachId, id);
  if (!item) return false;
  return deleteLibraryItem(item.id);
}

export async function createCampaignFromLibraryTemplate(
  coachId: string,
  input: {
    name: string;
    outreach_account_id?: string | null;
    templateId: string;
  }
) {
  const template = await getPublishedLibraryTemplate(input.templateId, coachId);
  const campaign = await createCampaign(coachId, {
    name: input.name.trim() || template.name,
    outreach_account_id: input.outreach_account_id ?? null,
    channel: template.channel,
  });
  const patch = settingsPatch(template.settings);
  const updated =
    Object.keys(patch).length > 0
      ? ((await updateCampaign(coachId, campaign.id, patch)) ?? campaign)
      : campaign;
  const steps = liveStepsFromLibrary(template);
  if (steps.length > 0) {
    await replaceCampaignSteps(updated.id, steps);
  }
  return updated;
}

export async function applyLibraryTemplateToCampaign(
  coachId: string,
  campaignId: string,
  templateId: string
) {
  const owned = await campaignOwnedByCoach(coachId, campaignId);
  if (!owned) throw new Error("Campaign not found.");

  const { count, error: countError } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) {
    throw new Error("This campaign already has steps.");
  }

  const template = await getPublishedLibraryTemplate(templateId, coachId);
  const { data: campaign } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("channel")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignChannelFrom(campaign?.channel ?? undefined) !== template.channel) {
    throw new Error("That template is for a different kind of campaign.");
  }
  const steps = await replaceCampaignSteps(
    campaignId,
    liveStepsFromLibrary(template)
  );
  return { steps };
}

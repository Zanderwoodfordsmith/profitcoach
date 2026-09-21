import {
  getLibraryItem,
  listLibraryItems,
} from "@/lib/campaignLibrary/store";
import {
  liveStepsFromLibrary,
  isLibraryItemId,
  publishedTemplateError,
} from "@/lib/campaignLibrary/instantiateCore";
import {
  toCoachCampaignTemplate,
  type CampaignLibraryItemDetail,
  type CampaignLibraryTemplateSettings,
  type CoachCampaignTemplate,
} from "@/lib/campaignLibrary/types";
import {
  campaignOwnedByCoach,
  createCampaign,
  replaceCampaignSteps,
  updateCampaign,
} from "@/lib/unipile/campaigns";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export {
  isLibraryItemId,
  liveStepsFromLibrary,
  publishedTemplateError,
} from "@/lib/campaignLibrary/instantiateCore";

function settingsPatch(
  settings: CampaignLibraryTemplateSettings | Record<string, never>
): Record<string, unknown> {
  if (!("daily_invite_limit" in settings)) return {};
  return {
    stop_on_reply: settings.stop_on_reply,
    daily_invite_limit: settings.daily_invite_limit,
    daily_message_limit: settings.daily_message_limit,
    daily_react_limit: settings.daily_react_limit,
    timezone: settings.timezone,
    send_rules: settings.send_rules,
  };
}

export async function listCoachCampaignTemplates(): Promise<
  CoachCampaignTemplate[]
> {
  const items = await listLibraryItems({
    itemType: "template",
    status: "published",
  });
  return items.map(toCoachCampaignTemplate);
}

export async function getPublishedLibraryTemplate(
  id: string
): Promise<CampaignLibraryItemDetail> {
  if (!isLibraryItemId(id)) {
    throw new Error("Template not found.");
  }
  const item = await getLibraryItem(id.trim());
  const error = publishedTemplateError(item);
  if (error || !item) throw new Error(error ?? "Template not found.");
  return item;
}

export async function createCampaignFromLibraryTemplate(
  coachId: string,
  input: {
    name: string;
    outreach_account_id?: string | null;
    templateId: string;
  }
) {
  const template = await getPublishedLibraryTemplate(input.templateId);
  const campaign = await createCampaign(coachId, {
    name: input.name.trim() || template.name,
    outreach_account_id: input.outreach_account_id ?? null,
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

  const template = await getPublishedLibraryTemplate(templateId);
  const steps = await replaceCampaignSteps(
    campaignId,
    liveStepsFromLibrary(template)
  );
  return { steps };
}

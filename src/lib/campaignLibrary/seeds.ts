import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { defaultLibraryTemplateSettings } from "@/lib/campaignLibrary/sanitize";
import { CONNECTOR_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/connector";
import { POSITIVE_REPLY_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/positiveReply";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import { replaceLibrarySteps } from "@/lib/campaignLibrary/store";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const LIBRARY_SEEDS: CampaignLibrarySeed[] = [
  CONNECTOR_LIBRARY_SEED,
  POSITIVE_REPLY_LIBRARY_SEED,
];

function stepsWithPositions(seed: CampaignLibrarySeed): CampaignStepInput[] {
  return seed.steps.map((step, position) => ({ ...step, position }));
}

async function upsertLibrarySeed(
  seed: CampaignLibrarySeed,
  replace: boolean
): Promise<{ id: string; created: boolean }> {
  const { data: existing, error } = await supabaseAdmin
    .from("campaign_library_items")
    .select("id")
    .eq("item_type", seed.itemType)
    .eq("kind", seed.kind)
    .eq("name", seed.name)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const settings = {
    ...defaultLibraryTemplateSettings(),
    ...seed.settings,
  };

  if (existing?.id) {
    if (replace) {
      const { error: updateError } = await supabaseAdmin
        .from("campaign_library_items")
        .update({
          description: seed.description,
          status: seed.status,
          settings,
        })
        .eq("id", existing.id);
      if (updateError) throw new Error(updateError.message);
      await replaceLibrarySteps(existing.id, stepsWithPositions(seed));
    }
    return { id: existing.id, created: false };
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from("campaign_library_items")
    .insert({
      item_type: seed.itemType,
      kind: seed.kind,
      name: seed.name,
      description: seed.description,
      settings,
      status: seed.status,
    })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);
  await replaceLibrarySteps(created.id, stepsWithPositions(seed));
  return { id: created.id, created: true };
}

/**
 * Idempotent. By default only creates missing canonical templates so later
 * admin edits are kept. Pass `{ replace: true }` to refresh copy.
 */
export async function ensureCampaignLibrarySeeds(options?: {
  replace?: boolean;
}): Promise<Array<{ id: string; created: boolean; name: string }>> {
  const replace = options?.replace === true;
  const results = [];
  for (const seed of LIBRARY_SEEDS) {
    const result = await upsertLibrarySeed(seed, replace);
    results.push({ ...result, name: seed.name });
  }
  return results;
}

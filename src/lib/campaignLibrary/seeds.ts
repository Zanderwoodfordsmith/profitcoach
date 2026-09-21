import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { defaultLibraryTemplateSettings } from "@/lib/campaignLibrary/sanitize";
import { LIBRARY_SEEDS } from "@/lib/campaignLibrary/seeds/catalog";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import { replaceLibrarySteps } from "@/lib/campaignLibrary/store";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

export { LIBRARY_SEEDS } from "@/lib/campaignLibrary/seeds/catalog";

function stepsWithPositions(seed: CampaignLibrarySeed): CampaignStepInput[] {
  return seed.steps.map((step, position) => ({ ...step, position }));
}

async function findExistingSeed(
  seed: CampaignLibrarySeed
): Promise<{ id: string; name: string } | null> {
  const names = [seed.name, ...(seed.previousNames ?? [])];
  const { data, error } = await supabaseAdmin
    .from("campaign_library_items")
    .select("id, name")
    .eq("item_type", seed.itemType)
    .eq("kind", seed.kind)
    .in("name", names);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const current = rows.find((row) => row.name === seed.name);
  const row = current ?? rows[0];
  if (!row?.id) return null;
  return { id: row.id, name: row.name };
}

async function upsertLibrarySeed(
  seed: CampaignLibrarySeed,
  replace: boolean
): Promise<{ id: string; created: boolean }> {
  const existing = await findExistingSeed(seed);

  const settings = {
    ...defaultLibraryTemplateSettings(),
    ...seed.settings,
  };

  if (existing?.id) {
    const shouldRename = existing.name !== seed.name;
    if (replace || shouldRename) {
      const { error: updateError } = await supabaseAdmin
        .from("campaign_library_items")
        .update(
          replace
            ? {
                name: seed.name,
                description: seed.description,
                status: seed.status,
                settings,
              }
            : { name: seed.name }
        )
        .eq("id", existing.id);
      if (updateError) throw new Error(updateError.message);
      if (replace) {
        await replaceLibrarySteps(existing.id, stepsWithPositions(seed));
      }
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

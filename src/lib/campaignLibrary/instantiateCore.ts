import type { CampaignLibraryItemDetail } from "@/lib/campaignLibrary/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const LIBRARY_ITEM_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLibraryItemId(value: string): boolean {
  return LIBRARY_ITEM_ID_RE.test(value.trim());
}

export function publishedTemplateError(
  item: CampaignLibraryItemDetail | null
): string | null {
  if (!item || item.item_type !== "template" || item.status !== "published") {
    return "Template not found.";
  }
  return null;
}

/** Copy library steps onto a live campaign: drop library ids, keep order. */
export function liveStepsFromLibrary(item: {
  steps: CampaignStepInput[];
}): CampaignStepInput[] {
  return item.steps.map((step, position) => {
    const { id: _id, ...rest } = step;
    return { ...rest, position };
  });
}

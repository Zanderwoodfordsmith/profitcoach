import type { CampaignLibraryItemDetail } from "@/lib/campaignLibrary/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const LIBRARY_ITEM_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLibraryItemId(value: string): boolean {
  return LIBRARY_ITEM_ID_RE.test(value.trim());
}

/** BCA's published templates, or the coach's own; never another coach's. */
export function publishedTemplateError(
  item: CampaignLibraryItemDetail | null,
  coachId: string | null = null
): string | null {
  if (!item || item.item_type !== "template") return "Template not found.";
  if (item.coach_id) {
    return item.coach_id === coachId ? null : "Template not found.";
  }
  return item.status === "published" ? null : "Template not found.";
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

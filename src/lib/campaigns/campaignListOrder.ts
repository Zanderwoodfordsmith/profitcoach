import { partitionOutreachCampaigns } from "@/lib/leadMagnets/catalog";

type CampaignListRow = {
  source_playbook_id?: string | null;
  status: string;
  lead_count?: number;
  updated_at: string;
  list_order?: number | null;
};

/** Visible campaign order. Custom `list_order` wins once any row has one. */
export function orderCampaignsForDisplay<T extends CampaignListRow>(
  campaigns: T[]
): T[] {
  const { ordered, more } = partitionOutreachCampaigns(campaigns);
  const fallback = [...ordered, ...more];
  const custom = fallback.some(
    (campaign) => typeof campaign.list_order === "number"
  );
  if (!custom) return fallback;

  return [...fallback].sort((a, b) => {
    const ao =
      typeof a.list_order === "number"
        ? a.list_order
        : Number.POSITIVE_INFINITY;
    const bo =
      typeof b.list_order === "number"
        ? b.list_order
        : Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return fallback.indexOf(a) - fallback.indexOf(b);
  });
}

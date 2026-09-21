import type { CampaignStepInput } from "@/lib/unipile/campaigns";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";

export const CAMPAIGN_LIBRARY_ITEM_TYPES = [
  "template",
  "sequence",
  "step",
] as const;

export type CampaignLibraryItemType =
  (typeof CAMPAIGN_LIBRARY_ITEM_TYPES)[number];

export const CAMPAIGN_LIBRARY_KINDS = [
  "connector",
  "reactivation",
  "nurture",
  "positive_reply",
] as const;

export type CampaignLibraryKind = (typeof CAMPAIGN_LIBRARY_KINDS)[number];

export const CAMPAIGN_LIBRARY_STATUSES = ["draft", "published"] as const;

export type CampaignLibraryStatus = (typeof CAMPAIGN_LIBRARY_STATUSES)[number];

export const CAMPAIGN_LIBRARY_KIND_LABEL: Record<CampaignLibraryKind, string> =
  {
    connector: "Connector",
    reactivation: "Reactivation",
    nurture: "Ongoing nurture",
    positive_reply: "Positive reply",
  };

export const CAMPAIGN_LIBRARY_TYPE_LABEL: Record<
  CampaignLibraryItemType,
  string
> = {
  template: "Template",
  sequence: "Sequence",
  step: "Step",
};

export const DEFAULT_LIBRARY_ITEM_NAME: Record<CampaignLibraryItemType, string> =
  {
    template: "Untitled template",
    sequence: "Untitled sequence",
    step: "Untitled step",
  };

export type CampaignLibraryTemplateSettings = {
  stop_on_reply: boolean;
  daily_invite_limit: number;
  daily_message_limit: number;
  daily_react_limit: number;
  timezone: string;
  send_rules: AvailabilityRuleRow[];
};

export type CampaignLibraryItemSummary = {
  id: string;
  item_type: CampaignLibraryItemType;
  kind: CampaignLibraryKind;
  name: string;
  description: string | null;
  status: CampaignLibraryStatus;
  settings: CampaignLibraryTemplateSettings | Record<string, never>;
  step_count: number;
  step_types: string[];
  created_at: string;
  updated_at: string;
};

export type CampaignLibraryItemDetail = CampaignLibraryItemSummary & {
  steps: CampaignStepInput[];
};

export function isCampaignLibraryItemType(
  value: unknown
): value is CampaignLibraryItemType {
  return (
    typeof value === "string" &&
    (CAMPAIGN_LIBRARY_ITEM_TYPES as readonly string[]).includes(value)
  );
}

export function isCampaignLibraryKind(
  value: unknown
): value is CampaignLibraryKind {
  return (
    typeof value === "string" &&
    (CAMPAIGN_LIBRARY_KINDS as readonly string[]).includes(value)
  );
}

export function isCampaignLibraryStatus(
  value: unknown
): value is CampaignLibraryStatus {
  return (
    typeof value === "string" &&
    (CAMPAIGN_LIBRARY_STATUSES as readonly string[]).includes(value)
  );
}

export function libraryItemEditorHref(item: {
  id: string;
  item_type: CampaignLibraryItemType;
}): string {
  if (item.item_type === "sequence") {
    return `/admin/campaign-library/sequences/${item.id}`;
  }
  if (item.item_type === "step") {
    return `/admin/campaign-library/steps/${item.id}`;
  }
  return `/admin/campaign-library/${item.id}`;
}

export function libraryListHref(type: CampaignLibraryItemType): string {
  if (type === "sequence") return "/admin/campaign-library?tab=sequences";
  if (type === "step") return "/admin/campaign-library?tab=steps";
  return "/admin/campaign-library";
}

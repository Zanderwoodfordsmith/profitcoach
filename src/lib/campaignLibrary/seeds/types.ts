import type { CampaignStepInput } from "@/lib/unipile/campaigns";
import type {
  CampaignLibraryItemType,
  CampaignLibraryKind,
  CampaignLibraryStatus,
  CampaignLibraryTemplateSettings,
} from "@/lib/campaignLibrary/types";

export type CampaignLibrarySeed = {
  sourceKey: string;
  itemType: CampaignLibraryItemType;
  kind: CampaignLibraryKind;
  name: string;
  description: string;
  status: CampaignLibraryStatus;
  settings?: Partial<CampaignLibraryTemplateSettings>;
  steps: Array<Omit<CampaignStepInput, "position"> | CampaignStepInput>;
};

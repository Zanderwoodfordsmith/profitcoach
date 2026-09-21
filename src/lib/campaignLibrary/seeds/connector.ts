import { VIP_GET_INTEREST_PLAYBOOK } from "@/lib/unipile/playbooks/connectorVip";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

export const CONNECTOR_LIBRARY_SEED: CampaignLibrarySeed = {
  sourceKey: "connector",
  itemType: "template",
  kind: "connector",
  name: "Connector",
  description: VIP_GET_INTEREST_PLAYBOOK.description,
  status: "published",
  settings: { daily_invite_limit: 9 },
  steps: VIP_GET_INTEREST_PLAYBOOK.steps,
};

export function connectorLibrarySteps(): CampaignStepInput[] {
  return CONNECTOR_LIBRARY_SEED.steps.map((step, position) => ({
    ...step,
    position,
  }));
}

"use client";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ProposalsList } from "@/components/proposals/ProposalsList";

export default function CoachWelcomePacksPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Keep Clients"
        description="A welcome pack for each new client, with their name on the cover."
        tabs={<CoachToolsHubTabs hub="coach-clients" />}
      />
      <ProposalsList kind="welcome" />
    </div>
  );
}

"use client";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ProposalsList } from "@/components/proposals/ProposalsList";

export default function CoachProposalsPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Get Clients"
        description="Proposals you send to owners, and who has opened and signed them."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <ProposalsList />
    </div>
  );
}

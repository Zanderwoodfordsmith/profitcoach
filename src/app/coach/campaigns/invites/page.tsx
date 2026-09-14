"use client";

import { LinkedInPendingInvitesPanel } from "@/components/campaigns/LinkedInPendingInvitesPanel";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";

export default function CoachCampaignInvitesPage() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-6xl"
      header={
        <StickyPageHeader
          title="Get Clients"
          description="Withdraw pending LinkedIn connection requests, by hand or on a schedule."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      <LinkedInPendingInvitesPanel />
    </DashboardPageSection>
  );
}

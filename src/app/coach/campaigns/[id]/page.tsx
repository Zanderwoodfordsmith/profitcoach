"use client";

import { LinkedInCampaignEditor } from "@/components/campaigns/LinkedInCampaignEditor";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";

export default function CoachCampaignDetailPage() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-7xl"
      gapClass="gap-3"
      header={
        <StickyPageHeader
          title="Get Clients"
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      <LinkedInCampaignEditor />
    </DashboardPageSection>
  );
}

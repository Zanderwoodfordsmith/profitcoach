"use client";

import { LeadMagnetEditor } from "@/components/campaigns/LeadMagnetEditor";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";

export default function CoachLeadMagnetPage() {
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
      <LeadMagnetEditor />
    </DashboardPageSection>
  );
}

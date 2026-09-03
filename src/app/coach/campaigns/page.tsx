"use client";

import { Suspense } from "react";
import { LinkedInCampaignsOverview } from "@/components/campaigns/LinkedInCampaignsOverview";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";

export default function CoachCampaignsPage() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-6xl"
      header={
        <StickyPageHeader
          title="Get Clients"
          description="LinkedIn outreach campaigns."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
        <LinkedInCampaignsOverview />
      </Suspense>
    </DashboardPageSection>
  );
}

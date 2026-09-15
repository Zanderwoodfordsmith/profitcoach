"use client";

import { Suspense } from "react";
import { LinkedInCampaignsOverview } from "@/components/campaigns/LinkedInCampaignsOverview";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminCampaignsPage() {
  useRequireAdminRole("/coach/campaigns");

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      gapClass="gap-3"
      outerClassName="h-full min-h-0 flex-1"
      contentClassName="min-h-0 flex-1 overflow-hidden"
      header={
        <StickyPageHeader
          className="shrink-0"
          title="Get Clients"
          description="Outreach campaigns and the lead magnets they send people to."
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

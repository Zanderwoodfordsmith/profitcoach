"use client";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { LeadMagnetsList } from "@/components/leadMagnets/LeadMagnetsList";

export default function CoachLeadMagnetsPage() {
  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Get Clients"
        description="Shareable assessments and opt-in funnels you can send to owners."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <LeadMagnetsList />
    </div>
  );
}

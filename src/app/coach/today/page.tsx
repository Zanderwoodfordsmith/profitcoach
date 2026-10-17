"use client";

import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { TodayHub } from "@/components/today/TodayHub";

export default function CoachTodayPage() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-4xl"
      header={
        <StickyPageHeader
          title="Get Clients"
          description="Your daily 1-10-10 and the people already showing interest."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      <TodayHub />
    </DashboardPageSection>
  );
}

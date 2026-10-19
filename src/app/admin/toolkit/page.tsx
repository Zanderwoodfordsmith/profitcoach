"use client";

import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ToolkitHub } from "@/components/toolkit/ToolkitHub";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminToolkitPage() {
  useRequireAdminRole("/coach/toolkit");

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-7xl"
      header={
        <StickyPageHeader
          title="Get Clients"
          description="The 90-day brochure from your Blueprint, plus posts, banners and print files with your name and QR code."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      <ToolkitHub />
    </DashboardPageSection>
  );
}

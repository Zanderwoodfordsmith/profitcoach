"use client";

import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ShareLinksHub } from "@/components/shareLinks/ShareLinksHub";
import { ToolkitTabs } from "@/components/toolkit/ToolkitTabs";

export default function CoachShareLinksPage() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-7xl"
      header={
        <StickyPageHeader
          title="Get Clients"
          description="Copy a link, or send it in a conversation."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      <ToolkitTabs active="links" />
      <ShareLinksHub />
    </DashboardPageSection>
  );
}

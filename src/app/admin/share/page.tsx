"use client";

import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ShareLinksHub } from "@/components/shareLinks/ShareLinksHub";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminShareLinksPage() {
  useRequireAdminRole("/coach/share");

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
      <ShareLinksHub />
    </DashboardPageSection>
  );
}

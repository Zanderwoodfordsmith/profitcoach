"use client";

import { CampaignLibrarySubTabs } from "@/components/admin/campaignLibrary/CampaignLibrarySubTabs";
import { GroupTestsAdmin } from "@/components/admin/campaignLibrary/GroupTestsAdmin";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminGroupTestsPage() {
  useRequireAdminRole("/coach");
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-6xl"
      header={
        <StickyPageHeader
          title="Campaign library"
          description="Group tests: one step, two fixed versions, run by many coaches so results are big enough to trust."
        />
      }
    >
      <CampaignLibrarySubTabs active="group_tests" />
      <GroupTestsAdmin />
    </DashboardPageSection>
  );
}

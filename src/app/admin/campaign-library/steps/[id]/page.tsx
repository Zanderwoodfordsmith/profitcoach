"use client";

import { useParams } from "next/navigation";
import { LibraryStepEditor } from "@/components/admin/campaignLibrary/LibraryStepEditor";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminCampaignLibraryStepPage() {
  useRequireAdminRole("/coach");
  const params = useParams<{ id: string }>();

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-4xl"
      header={
        <StickyPageHeader
          title="Library step"
          description="One message or action you can reuse later."
        />
      }
    >
      <LibraryStepEditor itemId={params.id} />
    </DashboardPageSection>
  );
}

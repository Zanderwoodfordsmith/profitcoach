"use client";

import { useParams } from "next/navigation";
import { LibrarySequenceEditor } from "@/components/admin/campaignLibrary/LibrarySequenceEditor";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminCampaignLibraryTemplatePage() {
  useRequireAdminRole("/coach");
  const params = useParams<{ id: string }>();

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      header={
        <StickyPageHeader
          title="Campaign template"
          description="Build the full sequence. Settings on this template are the defaults when it is used later."
        />
      }
    >
      <LibrarySequenceEditor itemId={params.id} expectedType="template" />
    </DashboardPageSection>
  );
}

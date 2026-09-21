"use client";

import { useParams } from "next/navigation";
import { LibrarySequenceEditor } from "@/components/admin/campaignLibrary/LibrarySequenceEditor";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminCampaignLibrarySequencePage() {
  useRequireAdminRole("/coach");
  const params = useParams<{ id: string }>();

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      header={
        <StickyPageHeader
          title="Campaign sequence"
          description="A reusable stretch of steps — not a full campaign."
        />
      }
    >
      <LibrarySequenceEditor itemId={params.id} expectedType="sequence" />
    </DashboardPageSection>
  );
}

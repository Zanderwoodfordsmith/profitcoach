"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CampaignLibraryList } from "@/components/admin/campaignLibrary/CampaignLibraryList";
import { CampaignLibrarySubTabs } from "@/components/admin/campaignLibrary/CampaignLibrarySubTabs";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";
import type { CampaignLibraryItemType } from "@/lib/campaignLibrary/types";

function tabFromSearch(raw: string | null): CampaignLibraryItemType {
  if (raw === "sequences") return "sequence";
  if (raw === "steps") return "step";
  return "template";
}

function CampaignLibraryBody() {
  const searchParams = useSearchParams();
  const itemType = tabFromSearch(searchParams.get("tab"));
  return (
    <>
      <CampaignLibrarySubTabs active={itemType} />
      <CampaignLibraryList itemType={itemType} />
    </>
  );
}

export default function AdminCampaignLibraryPage() {
  useRequireAdminRole("/coach");

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-6xl"
      header={
        <StickyPageHeader
          title="Campaign library"
          description="Save full campaign templates, reusable sequences, and individual steps. Members do not see this yet."
        />
      }
    >
      <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
        <CampaignLibraryBody />
      </Suspense>
    </DashboardPageSection>
  );
}

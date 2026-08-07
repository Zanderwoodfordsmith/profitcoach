"use client";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ProspectsPipelineBoard } from "@/components/prospects/ProspectsPipelineBoard";
import { useProspectsPage } from "@/hooks/useProspectsPage";

export default function AdminPipelinePage() {
  const page = useProspectsPage({ scope: "admin" });

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        rootRef={page.pageHeaderRef}
        title="Get Clients"
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />

      {page.error && <p className="text-sm text-rose-600">{page.error}</p>}

      <ProspectsPipelineBoard
        prospects={page.prospects}
        loading={page.loading || page.scoresEnriching}
        showCoachFilter
        coachFilterOptions={page.coachOptions}
        onUpdateProspect={page.handleUpdateProspect}
      />
    </div>
  );
}

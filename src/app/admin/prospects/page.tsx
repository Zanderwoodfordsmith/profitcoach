"use client";

import { flushSync } from "react-dom";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import {
  ProspectsTable,
  type ProspectRow,
} from "@/components/prospects/ProspectsTable";
import { AddProspectForm } from "@/components/prospects/AddProspectForm";
import { ProspectsDailyBarChart } from "@/components/admin/ProspectsDailyBarChart";
import { prospectWorkspacePath } from "@/lib/prospects/loadEnrichedProspect";
import { useProspectsPage } from "@/hooks/useProspectsPage";

export default function AdminProspectsPage() {
  const router = useRouter();
  const { setImpersonatingCoachId } = useImpersonation();
  const page = useProspectsPage({ scope: "admin" });

  const navigateToProspect = useCallback(
    (row: ProspectRow) => {
      flushSync(() => {
        if (row.coach_id) setImpersonatingCoachId(row.coach_id);
      });
      router.push(prospectWorkspacePath(row.id, { admin: true }));
    },
    [router, setImpersonatingCoachId]
  );

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        rootRef={page.pageHeaderRef}
        title="Get Clients"
        description="View prospects by coach, filter, and add prospects directly from the admin area."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />

      {page.loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}
      {page.error && <p className="text-sm text-rose-600">{page.error}</p>}

      <ProspectsDailyBarChart
        prospects={page.prospects}
        loading={page.loading}
      />

      {page.showAddProspect && (
        <AddProspectForm
          fullName={page.newFullName}
          email={page.newEmail}
          businessName={page.newBusinessName}
          sendInvite={page.sendInvite}
          onFullNameChange={page.setNewFullName}
          onEmailChange={page.setNewEmail}
          onBusinessNameChange={page.setNewBusinessName}
          onSendInviteChange={page.setSendInvite}
          onSubmit={page.handleCreateProspect}
          onClose={page.closeAddProspect}
          creating={page.creatingProspect}
          createError={page.createError}
          createSuccess={page.createSuccess}
          coachOptions={page.coachOptions}
          selectedCoachId={page.newCoachId}
          onCoachIdChange={(id) => page.setNewCoachId(id)}
          title="Add prospect"
          description="Create a prospect under a specific coach and optionally copy their assessment link so you can email it to them."
          inviteCheckboxLabel="Copy the assessment link for this coach to my clipboard after creating the prospect"
        />
      )}

      <div className="min-w-0 sm:-mx-3 sm:w-[calc(100%+1.5rem)]">
        <ProspectsTable
          prospects={page.prospects}
          loading={page.loading}
          error={page.error}
          stickyTopOffset={page.pageHeaderHeight}
          showCoachColumn={true}
          showTypeColumn={false}
          coachFilterOptions={page.coachOptions}
          onAddClick={page.openAddProspect}
          addActive={page.showAddProspect}
          onRowClick={(id) => {
            const row = page.prospects.find((p) => p.id === id);
            if (row) navigateToProspect(row);
          }}
          editable
          onUpdateProspect={page.handleUpdateProspect}
          onDelete={page.handleDeleteProspect}
          deletingId={page.deletingId}
          coachSlugByCoachId={page.coachSlugByCoachId}
          onVisibleIdsChange={page.enrichVisibleIds}
          scoresEnriching={page.scoresEnriching}
          emptyMessage="No prospects found for this selection."
        />
      </div>
    </div>
  );
}

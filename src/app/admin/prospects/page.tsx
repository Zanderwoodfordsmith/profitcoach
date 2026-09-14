"use client";

import { flushSync } from "react-dom";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { AddProspectForm } from "@/components/prospects/AddProspectForm";
import { ProspectsHub } from "@/components/prospects/ProspectsHub";
import { ProspectsDailyBarChart } from "@/components/admin/ProspectsDailyBarChart";
import { prospectWorkspacePath } from "@/lib/prospects/loadEnrichedProspect";
import { useProspectsPage } from "@/hooks/useProspectsPage";
import type { ProspectRow } from "@/lib/prospectRow";

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
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      gapClass="gap-4"
      outerClassName="h-full min-h-0 flex-1"
      contentClassName="min-h-0 flex-1"
      header={
        <StickyPageHeader
          className="shrink-0"
          rootRef={page.pageHeaderRef}
          title="Get Clients"
          description="View prospects by coach, filter, and add prospects directly from the admin area."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      {page.error && <p className="text-sm text-rose-600">{page.error}</p>}

      <div className="shrink-0">
        <ProspectsDailyBarChart
          prospects={page.prospects}
          loading={page.loading}
        />
      </div>

      {page.showAddProspect && (
        <div className="shrink-0">
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
        </div>
      )}

      <ProspectsHub
        prospects={page.prospects}
        loading={page.loading}
        error={page.error}
        surface="admin"
        stickyTopOffset={page.pageHeaderHeight}
        showCoachColumn
        coachFilterOptions={page.coachOptions}
        onAddClick={page.openAddProspect}
        addActive={page.showAddProspect}
        onProspectClick={navigateToProspect}
        onUpdateProspect={page.handleUpdateProspect}
        onProspectBooked={page.handleProspectBooked}
        onDelete={page.handleDeleteProspect}
        deletingId={page.deletingId}
        coachSlugByCoachId={page.coachSlugByCoachId}
        onVisibleIdsChange={page.enrichVisibleIds}
        scoresEnriching={page.scoresEnriching}
        emptyMessage="No prospects found for this selection."
        importUrl="/api/admin/contacts/import"
        importRequiresCoach
        onImportedProspects={page.mergeImportedProspects}
      />
    </DashboardPageSection>
  );
}

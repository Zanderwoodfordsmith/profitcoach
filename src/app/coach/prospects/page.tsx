"use client";

import { useRouter } from "next/navigation";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { AddProspectForm } from "@/components/prospects/AddProspectForm";
import { ProspectsHub } from "@/components/prospects/ProspectsHub";
import { prospectWorkspacePath } from "@/lib/prospects/loadEnrichedProspect";
import { useProspectsPage } from "@/hooks/useProspectsPage";

export default function CoachProspectsPage() {
  const router = useRouter();
  const page = useProspectsPage({ scope: "coach" });

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
          description="Add prospects and share your assessment link, or view those who have completed assessments."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      {page.error && <p className="text-sm text-rose-600">{page.error}</p>}

      {page.showAddProspect && page.effectiveCoachId && (
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
          fixedCoachId={page.effectiveCoachId}
          title="Add prospect"
          description="Create a prospect and optionally copy your assessment link to email them."
          inviteCheckboxLabel="Copy my assessment link to clipboard after creating"
        />
        </div>
      )}

      <ProspectsHub
        prospects={page.prospects}
        loading={page.loading}
        error={page.error}
        surface="coach"
        stickyTopOffset={page.pageHeaderHeight}
        onAddClick={page.openAddProspect}
        addActive={page.showAddProspect}
        onProspectClick={(row) => router.push(prospectWorkspacePath(row.id))}
        onUpdateProspect={page.handleUpdateProspect}
        onProspectBooked={page.handleProspectBooked}
        onDelete={page.handleDeleteProspect}
        deletingId={page.deletingId}
        coachSlug={page.coachSlug}
        onVisibleIdsChange={page.enrichVisibleIds}
        scoresEnriching={page.scoresEnriching}
        emptyMessage="No prospects yet. Add one below or share your assessment link."
        importUrl="/api/coach/contacts/import"
        onImportedProspects={page.mergeImportedProspects}
      />
    </DashboardPageSection>
  );
}

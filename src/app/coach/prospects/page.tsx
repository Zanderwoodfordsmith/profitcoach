"use client";

import { useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachClientHubAccess } from "@/hooks/useCoachClientHubAccess";
import { StickyPageHeader } from "@/components/layout";
import { ProspectsTable } from "@/components/prospects/ProspectsTable";
import { AddProspectForm } from "@/components/prospects/AddProspectForm";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";
import { useProspectsPage } from "@/hooks/useProspectsPage";

export default function CoachProspectsPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const { allowed: clientHubAllowed } =
    useCoachClientHubAccess(impersonatingCoachId);
  const page = useProspectsPage({ scope: "coach" });

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        rootRef={page.pageHeaderRef}
        title="Prospects"
        description="Add prospects and share your assessment link, or view those who have completed assessments."
      />

      {page.loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}
      {page.error && <p className="text-sm text-rose-600">{page.error}</p>}

      {page.showAddProspect && page.effectiveCoachId && (
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
      )}

      <div className="min-w-0 sm:-mx-3 sm:w-[calc(100%+1.5rem)]">
        <ProspectsTable
          prospects={page.prospects}
          loading={page.loading}
          error={page.error}
          stickyTopOffset={page.pageHeaderHeight}
          showCoachColumn={false}
          showTypeColumn={true}
          onAddClick={page.openAddProspect}
          addActive={page.showAddProspect}
          onRowClick={
            clientHubAllowed
              ? (id) => router.push(bossProHubPath(id))
              : undefined
          }
          editable
          onUpdateProspect={page.handleUpdateProspect}
          onDelete={page.handleDeleteProspect}
          deletingId={page.deletingId}
          coachSlug={page.coachSlug}
          onVisibleIdsChange={page.enrichVisibleIds}
          scoresEnriching={page.scoresEnriching}
          emptyMessage="No prospects yet. Add one below or share your assessment link."
        />
      </div>
    </div>
  );
}

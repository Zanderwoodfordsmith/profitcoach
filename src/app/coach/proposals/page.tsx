"use client";

import { StickyPageHeader } from "@/components/layout";
import { ProposalsList } from "@/components/proposals/ProposalsList";

export default function CoachProposalsPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader title="Proposals" description="Parked for later: a proposal per owner, sent, tracked and signed online." />
      <ProposalsList />
    </div>
  );
}

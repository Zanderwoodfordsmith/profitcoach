"use client";

import { StickyPageHeader } from "@/components/layout";
import { ProposalsList } from "@/components/proposals/ProposalsList";

export default function CoachWelcomePacksPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader title="Welcome packs" description="Parked for later: a welcome pack per new client." />
      <ProposalsList kind="welcome" />
    </div>
  );
}

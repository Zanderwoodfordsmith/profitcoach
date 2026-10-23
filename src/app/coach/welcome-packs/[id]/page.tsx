"use client";

import { useParams } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
import { ProposalEditor } from "@/components/proposals/ProposalEditor";

export default function CoachWelcomePackPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex flex-col">
      <StickyPageHeader title="Welcome packs" />
      <ProposalEditor id={id} />
    </div>
  );
}

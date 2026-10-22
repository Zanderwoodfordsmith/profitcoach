"use client";

import { useParams } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ProposalEditor } from "@/components/proposals/ProposalEditor";

export default function CoachProposalPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex flex-col">
      <StickyPageHeader title="Get Clients" tabs={<CoachToolsHubTabs hub="get-clients" />} />
      <ProposalEditor id={id} />
    </div>
  );
}

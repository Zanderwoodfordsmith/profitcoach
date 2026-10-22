"use client";

import { useParams } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ProposalEditor } from "@/components/proposals/ProposalEditor";

export default function CoachWelcomePackPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex flex-col">
      <StickyPageHeader title="Keep Clients" tabs={<CoachToolsHubTabs hub="coach-clients" />} />
      <ProposalEditor id={id} />
    </div>
  );
}

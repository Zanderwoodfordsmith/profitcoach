"use client";

import { Suspense } from "react";

import { CallSimHome } from "@/components/callSimulator/CallSimHome";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";

export default function CallSimulatorPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Win Clients"
        description="Practise your sales calls out loud with an AI owner, then get a score and a report. Get the nerves out here, not on a real call."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <Suspense fallback={null}>
        <CallSimHome />
      </Suspense>
    </div>
  );
}

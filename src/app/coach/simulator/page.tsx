"use client";

import { Suspense } from "react";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { SimulatorHome } from "@/components/simulator/SimulatorHome";

export default function ClientSimulatorPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Keep Clients"
        description="Practise real conversations out loud with AI clients, then get a score and a report."
        tabs={<CoachToolsHubTabs hub="coach-clients" />}
      />
      <Suspense fallback={null}>
        <SimulatorHome />
      </Suspense>
    </div>
  );
}

"use client";

import { use } from "react";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { SimReport } from "@/components/simulator/SimReport";

export default function ClientSimulatorReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="flex flex-col">
      <StickyPageHeader title="Keep Clients" tabs={<CoachToolsHubTabs hub="coach-clients" />} />
      <SimReport id={id} />
    </div>
  );
}

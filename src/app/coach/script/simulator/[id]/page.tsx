"use client";

import { use } from "react";

import { CallSimReport } from "@/components/callSimulator/CallSimReport";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";

export default function CallSimulatorReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="flex flex-col">
      <StickyPageHeader title="Get Clients" tabs={<CoachToolsHubTabs hub="get-clients" />} />
      <CallSimReport id={id} />
    </div>
  );
}

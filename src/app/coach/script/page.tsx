"use client";

import { Suspense } from "react";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ScriptsOverview } from "@/components/salesCall/ScriptsOverview";

export default function CoachScriptsPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Win Clients"
        description="Every script for your talks with owners, from first message to the close. Use words that already work instead of making them up."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <Suspense fallback={null}>
        <ScriptsOverview />
      </Suspense>
    </div>
  );
}

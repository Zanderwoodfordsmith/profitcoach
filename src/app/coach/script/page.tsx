"use client";

import { Suspense } from "react";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ScriptsOverview } from "@/components/salesCall/ScriptsOverview";

export default function CoachScriptsPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Get Clients"
        description="Every script for your conversations with owners, from first contact to the close."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <Suspense fallback={null}>
        <ScriptsOverview />
      </Suspense>
    </div>
  );
}

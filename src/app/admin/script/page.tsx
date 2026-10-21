"use client";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { SalesCallWorkspace } from "@/components/salesCall/SalesCallWorkspace";

export default function AdminScriptPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Get Clients"
        description="Your sales call script, step by step. Type or listen while you talk, and the pitch writes itself around what they tell you."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <SalesCallWorkspace />
    </div>
  );
}

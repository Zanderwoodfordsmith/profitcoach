"use client";

import { Suspense } from "react";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { LinkedInSchedulerPanel } from "@/components/admin/LinkedInSchedulerPanel";

export default function CoachLinkedInContentPage() {
  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Get Clients"
        description="Compose, schedule, and publish LinkedIn content."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <Suspense
        fallback={<p className="text-sm text-slate-600">Loading…</p>}
      >
        <LinkedInSchedulerPanel />
      </Suspense>
    </div>
  );
}

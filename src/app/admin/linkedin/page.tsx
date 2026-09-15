"use client";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { LinkedInSchedulerPanel } from "@/components/admin/LinkedInSchedulerPanel";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminLinkedInPage() {
  useRequireAdminRole("/coach/linkedin");

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Get Clients"
        description="Compose, schedule, and reuse LinkedIn content."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <LinkedInSchedulerPanel />
    </div>
  );
}

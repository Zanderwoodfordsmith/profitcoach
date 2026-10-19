"use client";

import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { CoachQualityBoard } from "@/components/admin/CoachQualityBoard";
import { StickyPageHeader } from "@/components/layout";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminCoachQualityPage() {
  useRequireAdminRole("/coach");
  return (
    <div className="flex w-full min-w-0 flex-col">
      <StickyPageHeader
        title="Coaches"
        description="Ava's audit: each coach's LinkedIn profile and campaigns against BCA's best practice, beside their volume and results."
        tabs={<CoachesHubTabs />}
      />
      <CoachQualityBoard />
    </div>
  );
}

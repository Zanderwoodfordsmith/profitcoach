"use client";

import { BlueprintsBoard } from "@/components/admin/BlueprintsBoard";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";

export default function AdminCoachesBlueprintPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StickyPageHeader title="Coaches" tabs={<CoachesHubTabs />} bleedInset="px-4 md:px-6" />
      <BlueprintsBoard />
    </div>
  );
}

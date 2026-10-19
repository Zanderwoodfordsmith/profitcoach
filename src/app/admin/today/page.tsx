"use client";

import { ToolkitHubTabs } from "@/components/admin/ToolkitHubTabs";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { TodayHub } from "@/components/today/TodayHub";

/** Admin only while it's redesigned. Coaches are sent to Conversations. */
export default function AdminTodayPage() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-4xl"
      header={
        <StickyPageHeader
          title="Today"
          description="Admin only while we redesign it. The daily 1-10-10 and the people already showing interest, for the coach you're viewing."
          tabs={<ToolkitHubTabs />}
        />
      }
    >
      <TodayHub />
    </DashboardPageSection>
  );
}

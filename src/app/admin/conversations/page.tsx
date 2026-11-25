"use client";

import { Suspense } from "react";
import { MessagingInbox } from "@/components/messaging/MessagingInbox";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminConversationsPage() {
  useRequireAdminRole("/coach/conversations");

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      gapClass="gap-0"
      outerClassName="flex h-full min-h-0 flex-1 flex-col"
      contentClassName="min-h-0 flex-1 overflow-hidden"
      header={
        <StickyPageHeader
          bleedInset="px-4 md:px-6"
          className="shrink-0"
          title="Get Calls"
          description="Every reply from LinkedIn, WhatsApp and email in one inbox, so no owner waits and no lead slips away."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      <Suspense
        fallback={
          <p className="px-4 py-8 text-sm text-slate-500">Loading inbox…</p>
        }
      >
        <MessagingInbox />
      </Suspense>
    </DashboardPageSection>
  );
}

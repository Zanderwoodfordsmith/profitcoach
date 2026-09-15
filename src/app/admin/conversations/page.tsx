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
          className="shrink-0"
          title="Get Clients"
          description="Inbox for LinkedIn, WhatsApp, email and booked-call messages. Sync pulls new threads from connected channels."
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

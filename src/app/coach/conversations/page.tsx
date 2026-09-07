"use client";

import { MessagingInbox } from "@/components/messaging/MessagingInbox";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";

export default function CoachConversationsPage() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      gapClass="gap-0"
      outerClassName="h-full min-h-0"
      contentClassName="min-h-0 flex-1 overflow-hidden"
      header={
        <StickyPageHeader
          title="Get Clients"
          description="Inbox for LinkedIn, WhatsApp, email and booked-call messages. Sync pulls new threads from connected channels."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      <MessagingInbox />
    </DashboardPageSection>
  );
}

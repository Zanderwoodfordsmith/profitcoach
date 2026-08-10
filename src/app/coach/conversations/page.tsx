"use client";

import { MessagingInbox } from "@/components/messaging/MessagingInbox";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";

export default function CoachConversationsPage() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      header={
        <StickyPageHeader
          title="Get Clients"
          description="Messages sent to your booked prospects."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      <MessagingInbox />
    </DashboardPageSection>
  );
}

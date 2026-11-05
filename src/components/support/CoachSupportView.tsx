"use client";

import { DashboardPageSection, StickyPageHeader } from "@/components/layout";

import { SupportChatsV3 } from "./SupportChatsV3";

/** Coach Support: chats look 3, picked by Zander on 5 Nov. */
export function CoachSupportView() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      gapClass="gap-0"
      outerClassName="h-full min-h-0"
      contentClassName="min-h-0 flex-1 overflow-hidden"
      header={
        // The list has roomy padding; the title takes the same inset so the two line up.
        <StickyPageHeader bleedInset="px-4 md:px-10 lg:px-14" title="Support" />
      }
    >
      <SupportChatsV3 />
    </DashboardPageSection>
  );
}

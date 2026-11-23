"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { DashboardPageSection, PageHeaderUnderlineTabs, StickyPageHeader } from "@/components/layout";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";

import { HelpCentre } from "./HelpCentre";
import { SupportChatsV3 } from "./SupportChatsV3";

/** Coach Support: chats look 3, picked by Zander on 5 Nov. Help tab (job 211) released to coaches 20 Nov; answers still waiting on Zander or Pam show to admins only. */
export function CoachSupportView() {
  return (
    <Suspense fallback={null}>
      <CoachSupportBody />
    </Suspense>
  );
}

function CoachSupportBody() {
  const params = useSearchParams();
  const { profile } = useDashboardProfile();
  const admin = profile?.role === "admin";
  const help = params.get("tab") === "help";
  const startNew = params.get("new") === "1";
  // Topic and answer pages bring their own topic sidebar, flush against the app sidebar.
  const helpRail = help && Boolean(params.get("topic") || params.get("a"));

  const tabs = (
    <PageHeaderUnderlineTabs
      ariaLabel="Support sections"
      items={[
        { kind: "link", href: "/coach/support", label: "Chats", active: !help, scroll: false },
        { kind: "link", href: "/coach/support?tab=help", label: "Help", active: help, scroll: false },
      ]}
    />
  );

  if (help) {
    return (
      // Support is a full-height page (the window never scrolls), so the Help column scrolls inside itself.
      <DashboardPageSection
        contentMaxWidthClass="max-w-none"
        gapClass="gap-0"
        outerClassName="h-full min-h-0"
        contentClassName={helpRail ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto px-4 pt-6 md:px-10 lg:px-14"}
        header={<StickyPageHeader bleedInset="px-4 md:px-10 lg:px-14" title="Support" tabs={tabs} />}
      >
        <HelpCentre topic={params.get("topic")} article={params.get("a")} admin={admin} />
      </DashboardPageSection>
    );
  }

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      gapClass="gap-0"
      outerClassName="h-full min-h-0"
      contentClassName="min-h-0 flex-1 overflow-hidden"
      header={
        // The list has roomy padding; the title takes the same inset so the two line up.
        <StickyPageHeader bleedInset="px-4 md:px-10 lg:px-14" title="Support" tabs={tabs} />
      }
    >
      <SupportChatsV3 startNew={startNew} />
    </DashboardPageSection>
  );
}

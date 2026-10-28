"use client";

import { CoachLevers } from "@/components/coachLevers/CoachLevers";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";

/** Admin-only until it's released; the coach route comes then. */
export default function CoachLeversPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Get Clients"
        description="Your four levers, from message to client. Put in your numbers, then drag to see what each one is worth."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <CoachLevers />
    </div>
  );
}

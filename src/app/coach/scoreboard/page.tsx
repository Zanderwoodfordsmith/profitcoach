"use client";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ScoreboardBoardV2 } from "@/components/scoreboard/ScoreboardBoardV2";

export default function CoachScoreboardPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Get Clients"
        description="Your numbers against your income target, from first outreach to new clients. Drag any of them to see what changes."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <ScoreboardBoardV2 />
    </div>
  );
}

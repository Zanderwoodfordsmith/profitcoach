"use client";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ScoreboardBoardV2 } from "@/components/scoreboard/ScoreboardBoardV2";

export default function CoachScoreboardPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Win Clients"
        description="Set your income target and see how many messages, calls and clients it takes. Drag any number to see what changes."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <ScoreboardBoardV2 />
    </div>
  );
}

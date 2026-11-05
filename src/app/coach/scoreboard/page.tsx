"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ScoreboardBoard } from "@/components/scoreboard/ScoreboardBoard";
import { ScoreboardBoardV2 } from "@/components/scoreboard/ScoreboardBoardV2";
import { scoreboardVersion } from "@/components/scoreboard/ScoreboardVersionSwitch";

function Board() {
  const params = useSearchParams();
  return scoreboardVersion(params.get("v")) === 1 ? <ScoreboardBoard /> : <ScoreboardBoardV2 />;
}

export default function CoachScoreboardPage() {
  return (
    <div className="flex flex-col">
      <StickyPageHeader
        title="Get Clients"
        description="Your numbers against your income target, from first outreach to new clients. Drag any of them to see what changes."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <Suspense fallback={null}>
        <Board />
      </Suspense>
    </div>
  );
}

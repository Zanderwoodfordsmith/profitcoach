"use client";

import { BossScorecardResults } from "@/components/scorecard/BossScorecardResults";
import {
  buildFakeScorecardAnswers,
  buildNaturalPreviewAnswers,
  buildScorecardResult,
} from "@/lib/bossScorecardScores";
import { getPrimaryCoachSlug } from "@/lib/primaryCoach";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

function PreviewScorecardResultsInner() {
  const searchParams = useSearchParams();
  const scoreParam = searchParams?.get("score");
  const coachSlug = searchParams?.get("coach")?.trim() || getPrimaryCoachSlug();
  const targetScore = scoreParam ? parseInt(scoreParam, 10) : null;

  const result = useMemo(() => {
    const answers =
      targetScore != null && Number.isFinite(targetScore)
        ? buildFakeScorecardAnswers(targetScore)
        : buildNaturalPreviewAnswers();
    return buildScorecardResult(
      answers,
      {
        annual_revenue: "1m_2m",
        team_size: "6_15",
        desired_outcome: "time_freedom",
        obstacles: ["consultants", "books_courses"],
        preferred_solution: "one_on_one",
      },
      "Preview open text response.",
      "Alex"
    );
  }, [targetScore]);

  return (
    <BossScorecardResults
      result={result}
      coachSlug={coachSlug}
      isPreview
    />
  );
}

export default function PreviewScorecardResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading…
        </div>
      }
    >
      <PreviewScorecardResultsInner />
    </Suspense>
  );
}

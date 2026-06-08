"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BossProReportResults } from "@/components/scorecard/BossProReportResults";
import {
  resolveReportCalendarContact,
  type CalendarContactParams,
} from "@/lib/calendarContactParams";
import {
  buildFakeScores,
  getTotalScore,
  type AnswersMap,
} from "@/lib/bossScores";
import { getPrimaryCoachSlug } from "@/lib/primaryCoach";

function BossProReportPreviewWrapper() {
  const searchParams = useSearchParams();
  const { answers, totalScore } = useMemo(() => {
    const preview =
      searchParams?.get("preview") === "1" ||
      searchParams?.get("preview") === "true";
    const scoreParam = searchParams?.get("score");
    const parsed = scoreParam ? parseInt(scoreParam, 10) : NaN;
    const target = Number.isFinite(parsed) ? parsed : 38;
    const fake = buildFakeScores(target);
    return {
      answers: fake as AnswersMap,
      totalScore: getTotalScore(fake),
    };
  }, [searchParams]);

  const coachSlug = searchParams?.get("coach")?.trim() || getPrimaryCoachSlug();
  const calendarContact: CalendarContactParams | null = resolveReportCalendarContact({
    searchParams,
  });

  return (
    <BossProReportResults
      answers={answers}
      totalScore={totalScore}
      coachSlug={coachSlug}
      isPreview
      calendarContact={calendarContact}
    />
  );
}

export default function BossProReportPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          Loading report…
        </div>
      }
    >
      <BossProReportPreviewWrapper />
    </Suspense>
  );
}

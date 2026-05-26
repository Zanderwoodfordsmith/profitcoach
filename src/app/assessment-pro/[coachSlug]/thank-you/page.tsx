"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ReportV3 } from "@/app/preview/report-v3/page";
import {
  buildFakeScores,
  getTotalScore,
  type AnswersMap,
} from "@/lib/bossScores";

const STORAGE_KEY = "boss_assessment_result";

export default function AssessmentThankYouPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const coachSlug = (params?.coachSlug as string) ?? "";

  const [answers, setAnswers] = useState<AnswersMap | null>(null);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const preview =
      searchParams?.get("preview") === "1" ||
      searchParams?.get("preview") === "true";
    const scoreParam = searchParams?.get("score");
    const targetScore = scoreParam ? parseInt(scoreParam, 10) : undefined;

    if (preview || (scoreParam && Number.isFinite(targetScore))) {
      const fake = buildFakeScores(targetScore);
      setAnswers(fake);
      setTotalScore(getTotalScore(fake));
      return;
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fake = buildFakeScores(72);
        setAnswers(fake);
        setTotalScore(getTotalScore(fake));
        return;
      }
      const data = JSON.parse(raw) as {
        answers?: AnswersMap;
        total_score?: number;
      };
      const a = data?.answers ?? {};
      setAnswers(a);
      setTotalScore(
        typeof data?.total_score === "number"
          ? data.total_score
          : getTotalScore(a)
      );
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      const fake = buildFakeScores(72);
      setAnswers(fake);
      setTotalScore(getTotalScore(fake));
    }
  }, [mounted, searchParams]);

  if (!mounted || answers === null || totalScore === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-slate-600">Loading your results…</p>
      </div>
    );
  }

  return (
    <ReportV3
      answers={answers}
      totalScore={totalScore}
      coachSlug={coachSlug}
      variant="live"
    />
  );
}

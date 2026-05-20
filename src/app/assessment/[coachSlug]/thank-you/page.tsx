"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BossScorecardResults } from "@/components/scorecard/BossScorecardResults";
import {
  buildFakeScorecardAnswers,
  buildScorecardResult,
  buildVariedScorecardAnswers,
  type ScorecardResultPayload,
} from "@/lib/bossScorecardScores";
import { getPrimaryCoachSlug } from "@/lib/primaryCoach";
import { supabaseClient } from "@/lib/supabaseClient";

const STORAGE_KEY = "boss_scorecard_result";

export default function ScorecardThankYouPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const coachSlug = (params?.coachSlug as string) ?? getPrimaryCoachSlug();

  const [result, setResult] = useState<ScorecardResultPayload | null>(null);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!coachSlug) return;
    void (async () => {
      try {
        const { data } = await supabaseClient
          .from("coaches")
          .select("profiles(full_name)")
          .eq("slug", coachSlug)
          .maybeSingle();
        const prof = (data as { profiles?: { full_name?: string } | null } | null)
          ?.profiles;
        if (prof?.full_name) setCoachName(prof.full_name);
      } catch {
        // ignore
      }
    })();
  }, [coachSlug]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const preview =
      searchParams?.get("preview") === "1" ||
      searchParams?.get("preview") === "true";
    const scoreParam = searchParams?.get("score");
    const useVaried = !scoreParam;
    const targetScore = scoreParam ? parseInt(scoreParam, 10) : 64;

    if (preview || scoreParam) {
      const answers = useVaried
        ? buildVariedScorecardAnswers()
        : buildFakeScorecardAnswers(
            Number.isFinite(targetScore) ? targetScore : 64
          );
      setResult(
        buildScorecardResult(
          answers,
          {
            annual_revenue: "500k_1m",
            team_size: "6_15",
            desired_outcome: "profit_income",
          },
          null,
          "Alex"
        )
      );
      return;
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setResult(
          buildScorecardResult(
            buildVariedScorecardAnswers(),
            { annual_revenue: "500k_1m", team_size: "2_5" },
            null
          )
        );
        return;
      }
      const data = JSON.parse(raw) as ScorecardResultPayload;
      setResult(data);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      setResult(
        buildScorecardResult(
          buildVariedScorecardAnswers(),
          { annual_revenue: "500k_1m", team_size: "2_5" },
          null
        )
      );
    }
  }, [mounted, searchParams]);

  if (!mounted || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-slate-600">Loading your results…</p>
      </div>
    );
  }

  const isPreview =
    searchParams?.get("preview") === "1" ||
    searchParams?.get("preview") === "true";

  return (
    <BossScorecardResults
      result={result}
      coachSlug={coachSlug}
      coachName={coachName}
      isPreview={isPreview}
    />
  );
}

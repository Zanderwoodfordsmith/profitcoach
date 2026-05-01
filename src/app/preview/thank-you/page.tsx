"use client";

import { useMemo } from "react";
import { BossGrid } from "@/components/BossGrid";
import {
  BossWheel,
  BossDoughnut,
  FocusAreas,
} from "@/components/BossCharts";
import {
  getTotalScore,
  computeAreaScores,
  buildFakeScores,
} from "@/lib/bossScores";
import { useWheelColorScheme } from "@/lib/useWheelColorScheme";
import { useWheelViewMode } from "@/lib/useWheelViewMode";

export default function ThankYouPreviewPage() {
  const [wheelColorScheme] = useWheelColorScheme();
  const [wheelViewMode] = useWheelViewMode();
  const { answers, totalScore } = useMemo(() => {
    const fake = buildFakeScores(72);
    return {
      answers: fake,
      totalScore: getTotalScore(fake),
    };
  }, []);

  const areaScores = useMemo(() => computeAreaScores(answers), [answers]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Preview — This is what prospects see after completing the assessment
        </p>

        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Business Operating System Score
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your assessment is complete. Review your score, top priorities, and
            full BOSS grid below.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl font-bold">
              ✓
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Assessment complete
            </h2>
            <p className="mt-2 text-slate-700">
              Your score:{" "}
              <span className="font-semibold text-emerald-600">
                {totalScore} / 100
              </span>
            </p>
            <p className="mt-4 max-w-xl text-sm text-slate-600">
              Thank you for completing your Business Operating System Score. Your
              BOSS grid has been updated — you can now see exactly where to focus
              next.
            </p>
            <div className="mt-6 w-full max-w-md text-left">
              <h3 className="text-sm font-semibold text-slate-800">
                Your top 3 focus areas
              </h3>
              <FocusAreas scores={answers} variant="compact" />
              <p className="mt-3 text-xs text-slate-500">
                These priorities use the same focus logic as your main BOSS
                dashboard.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] lg:grid-cols-[1fr_1fr_1fr]">
            <div className="flex justify-center">
              <BossWheel areaScores={areaScores} totalScore={totalScore} answers={answers} colorScheme={wheelColorScheme} viewMode={wheelViewMode} />
            </div>
            <div className="flex justify-center">
              <BossDoughnut scores={answers} />
            </div>
            <div className="lg:col-span-1">
              <FocusAreas scores={answers} variant="full" />
            </div>
          </div>
        </section>

        <section className="overflow-x-auto">
          <BossGrid
            answers={answers}
            showDials
            showHeaders
            playbookLinkBase="/playbooks"
          />
        </section>
      </div>
    </div>
  );
}

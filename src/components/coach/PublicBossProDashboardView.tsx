"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BossGridTransposed } from "@/components/BossGrid";
import { BossWheel } from "@/components/BossCharts";
import { BossScoreDialStrip, BossAnswerMixBar } from "@/components/coach/BossScoreDialStrip";
import { WorkshopOwnerLevelBars } from "@/components/coach/WorkshopOwnerLevelBars";
import { WorkshopInsightReader } from "@/components/coach/WorkshopInsightReader";
import type { StoredInsights } from "@/lib/insightGenerator";
import {
  computeAreaScores,
  computeBossPillarDialStats,
  computeScoreBreakdown,
  computeWorkshopScoreMixCategories,
  getTotalScore,
  type AnswersMap,
} from "@/lib/bossScores";
import { useWheelColorScheme } from "@/lib/useWheelColorScheme";
import { useWheelViewMode } from "@/lib/useWheelViewMode";

const WORKSHOP_CARD_SHELL =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]";

const WORKSHOP_CARD_HEADER =
  "border-b border-slate-600/40 bg-slate-700 px-4 py-2.5 text-sm font-semibold tracking-wide text-white";

export type PublicBossProDashboardViewProps = {
  contact: {
    full_name: string;
    business_name: string | null;
  };
  coachName?: string | null;
  answers: AnswersMap;
  totalScore: number;
  sessionInsights?: StoredInsights | null;
};

export function PublicBossProDashboardView({
  contact,
  answers,
  totalScore,
  sessionInsights = null,
}: PublicBossProDashboardViewProps) {
  const [wheelColorScheme] = useWheelColorScheme();
  const [wheelViewMode] = useWheelViewMode();
  const ownerLevelsCardRef = useRef<HTMLElement>(null);
  const [ownerLevelsCardHeight, setOwnerLevelsCardHeight] = useState<number | null>(null);

  const areaScores = useMemo(() => computeAreaScores(answers), [answers]);
  const pillarDialStats = useMemo(
    () => computeBossPillarDialStats(answers),
    [answers]
  );
  const answerMix = useMemo(() => computeScoreBreakdown(answers), [answers]);
  const scoreMixCategories = useMemo(
    () => computeWorkshopScoreMixCategories(answers),
    [answers]
  );
  const displayTotal = Object.keys(answers).length > 0 ? totalScore : getTotalScore(answers);

  useEffect(() => {
    const el = ownerLevelsCardRef.current;
    if (!el) return;

    const syncWheelCardHeight = () => {
      const isSideBySide = window.matchMedia("(min-width: 1024px)").matches;
      setOwnerLevelsCardHeight(isSideBySide ? el.offsetHeight : null);
    };

    syncWheelCardHeight();
    const observer = new ResizeObserver(syncWheelCardHeight);
    observer.observe(el);
    window.addEventListener("resize", syncWheelCardHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncWheelCardHeight);
    };
  }, [answers]);

  return (
    <div className="flex flex-col gap-6">
      <BossScoreDialStrip totalScore={displayTotal} pillarStats={pillarDialStats} />

      <section className="relative mt-3">
        <BossGridTransposed
          answers={answers}
          glass
          glassTheme="light"
          glassAlwaysShowPlaybookNames
          hideGlassScoreBar
          gridCornerLabel="Areas"
          interactive={false}
          scoreBarLabels="neutral"
          clientName={contact.full_name}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section ref={ownerLevelsCardRef} className={`${WORKSHOP_CARD_SHELL} flex flex-col`}>
          <div className={WORKSHOP_CARD_HEADER}>Owner level completeness</div>
          <div className="px-6 py-8 sm:px-8 sm:py-9">
            <WorkshopOwnerLevelBars answers={answers} />
          </div>
        </section>

        <section
          className={`${WORKSHOP_CARD_SHELL} flex min-h-0 flex-col overflow-hidden max-lg:h-auto`}
          style={ownerLevelsCardHeight != null ? { height: ownerLevelsCardHeight } : undefined}
        >
          <div className={WORKSHOP_CARD_HEADER}>BOSS wheel</div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-5">
            <div className="aspect-square h-auto max-h-full w-full max-w-full">
              <BossWheel
                size="workshop"
                areaScores={areaScores}
                totalScore={displayTotal}
                answers={answers}
                colorScheme={wheelColorScheme}
                viewMode={wheelViewMode}
                showLegend={false}
                scorePlacement="wheel-lower-left"
                aria-label="BOSS area scores wheel"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <BossAnswerMixBar
          className="mx-0 max-w-none w-full"
          onTrack={answerMix.green}
          building={answerMix.amber}
          needsAttention={answerMix.red}
          notAnswered={answerMix.unanswered}
          scoreMixCategories={scoreMixCategories}
        />

        {sessionInsights ? (
          <section className={WORKSHOP_CARD_SHELL}>
            <div className={WORKSHOP_CARD_HEADER}>Insights</div>
            <div className="px-6 pb-8 pt-3.5 sm:px-8 sm:pb-9 sm:pt-4">
              <WorkshopInsightReader
                answers={answers}
                totalScore={displayTotal}
                insights={sessionInsights}
                insightsGenerating={false}
                insightsGenerationReady
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

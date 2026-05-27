"use client";

import { useMemo } from "react";
import { LEVEL_NAMES } from "@/lib/insightEngine";
import { getLevelIcon } from "@/lib/bossData";
import type { AnswersMap } from "@/lib/bossScores";
import { computeLevelScores } from "@/lib/bossScores";
import {
  BOSS_SCORE_PASTEL,
  BOSS_SCORE_SATURATED,
  BOSS_SCORE_SATURATED_DEEP,
  type BossScoreHue,
} from "@/lib/bossScorecardColors";

function levelHue(levelId: number): BossScoreHue {
  return Math.min(5, Math.max(1, levelId)) as BossScoreHue;
}

function ProgressBar({
  percent,
  hue,
}: {
  percent: number;
  hue: BossScoreHue;
}) {
  const deep = BOSS_SCORE_SATURATED_DEEP[hue];
  const mid = BOSS_SCORE_SATURATED[hue];
  const light = BOSS_SCORE_PASTEL[hue];

  return (
    <div className="h-3 overflow-hidden rounded-md bg-slate-100">
      <div
        className="h-full rounded-md transition-all duration-700 ease-out"
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          background: `linear-gradient(90deg, ${deep} 0%, ${mid} 52%, ${light} 100%)`,
        }}
      />
    </div>
  );
}

type WorkshopOwnerLevelBarsProps = {
  answers: AnswersMap;
};

export function WorkshopOwnerLevelBars({ answers }: WorkshopOwnerLevelBarsProps) {
  const levelScores = useMemo(() => computeLevelScores(answers), [answers]);

  return (
    <div className="flex flex-col gap-8 sm:gap-9">
      {levelScores.map((ls) => {
        const hue = levelHue(ls.level);
        const accent = BOSS_SCORE_SATURATED[hue];
        const percent = ls.percent ?? 0;
        const iconSrc = getLevelIcon(ls.level);

        return (
          <div key={ls.level} className="flex flex-col gap-2.5">
            <div className="flex w-full items-center gap-3.5">
              {iconSrc ? (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md"
                  style={{ backgroundColor: accent }}
                >
                  <div
                    className="h-7 w-7 shrink-0"
                    style={{
                      maskImage: `url(${iconSrc})`,
                      maskSize: "contain",
                      maskRepeat: "no-repeat",
                      maskPosition: "center",
                      WebkitMaskImage: `url(${iconSrc})`,
                      WebkitMaskSize: "contain",
                      WebkitMaskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      backgroundColor: "white",
                    }}
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: accent }}
                >
                  Level {ls.level}
                </p>
                <h3 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg">
                  {LEVEL_NAMES[ls.level]}
                </h3>
              </div>
              <span
                className="shrink-0 text-xl font-semibold tabular-nums sm:text-2xl"
                style={{ color: accent }}
              >
                {percent}%
              </span>
            </div>
            <ProgressBar percent={percent} hue={hue} />
          </div>
        );
      })}
    </div>
  );
}

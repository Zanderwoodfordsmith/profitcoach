"use client";

import { LEVEL_NAMES } from "@/lib/insightEngine";
import { BOSS_PRO_RING_TRACK } from "@/lib/bossProDialGradients";
import {
  BOSS_SCORE_PASTEL,
  BOSS_SCORE_SATURATED,
  BOSS_SCORE_SATURATED_DEEP,
  type BossScoreHue,
} from "@/lib/bossScorecardColors";

const LEVEL_ICONS = [
  "/levels/overwhelm.png",
  "/levels/overworked.png",
  "/levels/organised.png",
  "/levels/overseer.png",
  "/levels/owner.png",
] as const;

function levelHue(level: number): BossScoreHue {
  return Math.min(5, Math.max(1, level)) as BossScoreHue;
}

function levelBarGradient(hue: BossScoreHue): string {
  const deep = BOSS_SCORE_SATURATED_DEEP[hue];
  const mid = BOSS_SCORE_SATURATED[hue];
  const light = BOSS_SCORE_PASTEL[hue];
  return `linear-gradient(90deg, ${deep} 0%, ${mid} 52%, ${light} 100%)`;
}

function ProgressBarFigma({
  percent,
  fill,
  track,
}: {
  percent: number;
  fill: string;
  track: string;
}) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: track }}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
        style={{ width: `${p}%`, background: fill }}
      />
    </div>
  );
}

export type DashboardLevelDemo = {
  level: 1 | 2 | 3 | 4 | 5;
  score: number;
};

export function DashboardStyleLevelBarRow({
  level,
  score,
  className = "",
}: DashboardLevelDemo & { className?: string }) {
  const idx = level - 1;
  const hue = levelHue(level);
  const accent = BOSS_SCORE_SATURATED[hue];
  const barGradient = levelBarGradient(hue);
  const iconSrc = LEVEL_ICONS[idx] ?? LEVEL_ICONS[0];
  const name = LEVEL_NAMES[level] ?? `Level ${level}`;

  return (
    <div className={`flex w-full flex-col gap-3 ${className}`}>
      <div className="flex w-full items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className="flex size-[56px] shrink-0 items-center justify-center rounded-[10px]"
            style={{ backgroundColor: accent }}
          >
            <div
              className="size-7 shrink-0"
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
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p
              className="mt-1 text-[12px] font-medium uppercase leading-none tracking-[0.1em]"
              style={{ color: accent }}
            >
              Level {level}
            </p>
            <p className="mt-2 text-[20px] font-medium leading-none text-[#17181a]">{name}</p>
          </div>
        </div>
        <p
          className="shrink-0 text-[26px] font-medium tabular-nums leading-none"
          style={{ color: accent }}
        >
          {score}%
        </p>
      </div>
      <ProgressBarFigma percent={score} fill={barGradient} track={BOSS_PRO_RING_TRACK} />
    </div>
  );
}

export function DashboardStyleLevelBarsCard({
  levels = LANDING_C_LEVEL_DEMO,
  className = "",
}: {
  levels?: DashboardLevelDemo[];
  className?: string;
}) {
  return (
    <div
      className={`border-[0.75px] border-solid border-white/[0.56] bg-white/40 px-[22px] py-[22px] shadow-[0_15px_18.75px_rgba(10,82,145,0.08)] backdrop-blur-sm ${className}`}
      style={{ borderRadius: "20px" }}
    >
      <div className="flex flex-col gap-7">
        {levels.map((row) => (
          <DashboardStyleLevelBarRow key={row.level} {...row} />
        ))}
      </div>
    </div>
  );
}

/** Illustrative scores from Figma “Desktop - 2” (node 233:1524). */
export const LANDING_C_LEVEL_DEMO: DashboardLevelDemo[] = [
  { level: 1, score: 84 },
  { level: 2, score: 92 },
  { level: 3, score: 49 },
  { level: 4, score: 44 },
  { level: 5, score: 32 },
];

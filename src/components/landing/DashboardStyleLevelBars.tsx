"use client";

import { LEVEL_NAMES, LEVEL_SUBTITLES } from "@/lib/insightEngine";

/** Figma “Desktop - 2” level row tokens (node 233:1524 schedule rows). */
const FIGMA_LEVEL_STYLE: {
  iconBg: string;
  labelColor: string;
  percentColor: string;
  barGradient: string;
  track: string;
  status: string;
}[] = [
  {
    iconBg: "#f92e42",
    labelColor: "#f92e87",
    percentColor: "#f92e87",
    barGradient: "linear-gradient(90deg, #e6757b, #ef525d, #f92e3f)",
    track: "#dde3e9",
    status: "Strong",
  },
  {
    iconBg: "#f96a02",
    labelColor: "#f96a02",
    percentColor: "#f96a02",
    barGradient: "linear-gradient(90deg, #fea462, #fd954a, #f96a02)",
    track: "#dae1e6",
    status: "Strong",
  },
  {
    iconBg: "#c342e6",
    labelColor: "#c342e6",
    percentColor: "#ad47f9",
    barGradient: "linear-gradient(90deg, #d65ec6, #ac44fa)",
    track: "#dae1e6",
    status: "Making progress",
  },
  {
    iconBg: "#07bc94",
    labelColor: "#07bc94",
    percentColor: "#06b87c",
    barGradient: "linear-gradient(90deg, #4dd1b2, #15c18a, #02bb7d)",
    track: "#dae1e6",
    status: "Strong",
  },
  {
    iconBg: "#2881e9",
    labelColor: "#2881e9",
    percentColor: "#2881e9",
    barGradient: "linear-gradient(90deg, #5193e1, #2881e9)",
    track: "#dae1e6",
    status: "Strong",
  },
];

const LEVEL_ICONS = [
  "/levels/overwhelm.png",
  "/levels/overworked.png",
  "/levels/organised.png",
  "/levels/overseer.png",
  "/levels/owner.png",
] as const;

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

export function DashboardStyleLevelBarCard({
  level,
  score,
  className = "",
}: DashboardLevelDemo & { className?: string }) {
  const idx = level - 1;
  const fig = FIGMA_LEVEL_STYLE[idx] ?? FIGMA_LEVEL_STYLE[0];
  const iconSrc = LEVEL_ICONS[idx] ?? LEVEL_ICONS[0];
  const name = LEVEL_NAMES[level] ?? `Level ${level}`;
  const subtitle = LEVEL_SUBTITLES[level] ?? "";

  return (
    <div
      className={`flex min-h-[160px] w-full flex-col justify-center border-[0.75px] border-solid border-white/[0.56] bg-white/40 px-[22px] py-[26px] shadow-[0_15px_18.75px_rgba(10,82,145,0.08)] backdrop-blur-sm ${className}`}
      style={{ borderRadius: "20px" }}
    >
      <div className="flex w-full flex-col gap-[18px]">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className="flex size-[50px] shrink-0 items-center justify-center rounded-[10px]"
              style={{ backgroundColor: fig.iconBg }}
            >
              <div
                className="size-5 shrink-0"
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
                className="text-[14px] font-medium uppercase leading-none tracking-[0.1em]"
                style={{ color: fig.labelColor }}
              >
                Level {level}
              </p>
              <p className="mt-3 text-[20px] font-medium leading-none text-[#17181a]">{name}</p>
            </div>
          </div>
          <p
            className="shrink-0 text-[26px] font-medium tabular-nums leading-none"
            style={{ color: fig.percentColor }}
          >
            {score}%
          </p>
        </div>
        <ProgressBarFigma percent={score} fill={fig.barGradient} track={fig.track} />
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1 text-[17px] leading-snug">
          <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-[#2d2f46]">
            <span className="size-[5px] shrink-0 rounded-full bg-[#2d2f46]" aria-hidden />
            {fig.status}
          </span>
          <span className="min-w-0 flex-1 text-[#17181a]/40">{subtitle}</span>
        </div>
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

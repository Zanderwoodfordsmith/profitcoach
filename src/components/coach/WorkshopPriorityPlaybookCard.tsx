"use client";

import {
  BOSS_SCORE_SATURATED,
  type BossScoreHue,
} from "@/lib/bossScorecardColors";

function levelSolid(level1to5: number): string {
  const hue = Math.min(5, Math.max(1, level1to5)) as BossScoreHue;
  return BOSS_SCORE_SATURATED[hue];
}

export function WorkshopPriorityPlaybookCard({
  index,
  name,
  level,
  description,
  status,
  onClick,
}: {
  index: number;
  name: string;
  level: number;
  description: string;
  status: 0 | 1;
  onClick?: () => void;
}) {
  const isCritical = status === 0;
  const badgeLabel = isCritical ? "Critical" : "Needs work";
  const accent = isCritical ? "#f87171" : "#fcd34d";
  const bgImage = isCritical
    ? "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 38%, #dc2626 100%)"
    : "linear-gradient(135deg, #78350f 0%, #b45309 42%, #d97706 100%)";

  const className =
    "relative w-full overflow-hidden rounded-3xl text-left text-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.45)] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2";

  const inner = (
    <>
      <div
        className="absolute inset-0"
        style={{ background: bgImage, filter: "saturate(0.9)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg,rgba(15,23,42,0.05) 0%,rgba(15,23,42,0.45) 35%,rgba(15,23,42,0.85) 100%)",
        }}
      />
      <span
        className="absolute right-6 top-6 text-[72px] font-black leading-none tracking-tight sm:text-[88px]"
        style={{ color: "rgba(255,255,255,0.18)", fontVariantNumeric: "tabular-nums" }}
      >
        0{index}.
      </span>
      <div className="relative flex min-h-[280px] flex-col p-6 sm:min-h-[320px]">
        <div className="flex min-h-[2.25rem] shrink-0 items-start gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ background: accent, color: isCritical ? "white" : "#1c1917" }}
          >
            <span
              className={`h-2 w-2 rounded-full ${isCritical ? "bg-white" : "bg-amber-950/80"}`}
            />
            {badgeLabel}
          </span>
        </div>
        <div className="mt-6">
          <h3 className="text-xl font-semibold leading-tight sm:text-2xl">{name}</h3>
          <p className="mt-2 text-sm text-white/80">
            <span className="font-semibold text-white/95">Current Level:</span>{" "}
            <span
              className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-white"
              style={{ background: levelSolid(level) }}
            >
              {level}
            </span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/90">{description}</p>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} hover:scale-[1.01]`}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

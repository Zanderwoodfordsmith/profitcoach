"use client";

import type { BossPillarDialStat } from "@/lib/bossScores";

const TRACK_GREY = "#e8ecf1";
/** Overall grid dial accent (neutral, distinct from pillars). */
const OVERALL_COLOR = "#0c5280";

const DIAL_CARD_SHELL =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]";

const CARD_HEADER =
  "border-b border-slate-600/40 bg-slate-700 px-4 py-2.5 text-sm font-semibold tracking-wide text-white";

type BossScoreDialStripProps = {
  totalScore: number;
  pillarStats: BossPillarDialStat[];
  className?: string;
};

function DialCard({
  header,
  children,
  className = "",
  bodyClassName = "flex justify-center px-4 py-4",
}: {
  header: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`${DIAL_CARD_SHELL} ${className}`}>
      <div className={CARD_HEADER}>{header}</div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

function RingGauge({
  pctFill,
  color,
  centerPrimary,
  centerSecondary,
  percentSuffix = false,
  ariaLabel,
  size = "pillar",
}: {
  pctFill: number;
  color: string;
  centerPrimary: string;
  centerSecondary?: string;
  percentSuffix?: boolean;
  ariaLabel: string;
  size?: "hero" | "pillar";
}) {
  const sweepDeg = (Math.min(100, Math.max(0, pctFill)) / 100) * 360;
  const ringSizeClass =
    size === "hero"
      ? "h-[10.5rem] w-[10.5rem] sm:h-[11.5rem] sm:w-[11.5rem] md:h-[13rem] md:w-[13rem]"
      : "h-[7.25rem] w-[7.25rem] sm:h-[8rem] sm:w-[8rem] md:h-[8.75rem] md:w-[8.75rem]";
  const insetClass =
    size === "hero"
      ? "inset-[15px] sm:inset-[17px] md:inset-[19px]"
      : "inset-[11px] sm:inset-[12px] md:inset-[13px]";
  const primaryTextClass =
    size === "hero"
      ? "text-[2rem] sm:text-[2.375rem] md:text-[2.625rem]"
      : "text-[1.35rem] sm:text-2xl md:text-[1.875rem]";

  return (
    <div
      className={`relative shrink-0 ${ringSizeClass}`}
      role="img"
      aria-label={ariaLabel}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${color} 0deg ${sweepDeg}deg, ${TRACK_GREY} ${sweepDeg}deg 360deg)`,
        }}
      />
      <div
        className={`absolute ${insetClass} flex flex-col items-center justify-center rounded-full bg-white`}
      >
        <span
          className={`inline-flex items-baseline font-semibold tabular-nums leading-none tracking-tight text-slate-900 ${primaryTextClass}`}
        >
          {centerPrimary}
          {percentSuffix ? (
            <span className="ml-px text-[0.45em] font-medium text-slate-500">%</span>
          ) : null}
        </span>
        {centerSecondary ? (
          <span className="mt-0.5 text-[10px] font-medium tabular-nums text-slate-500 sm:text-[11px]">
            {centerSecondary}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BossScoreHeroCard({
  cappedTotal,
  overallPct,
  className = "",
}: {
  cappedTotal: number;
  overallPct: number;
  className?: string;
}) {
  return (
    <DialCard
      header="BOSS score"
      className={className}
      bodyClassName="flex justify-center px-7 py-8 sm:px-8 sm:py-9 md:px-9 md:py-10"
    >
      <RingGauge
        size="hero"
        pctFill={overallPct}
        color={OVERALL_COLOR}
        centerPrimary={`${cappedTotal}`}
        centerSecondary="/ 100"
        ariaLabel={`BOSS score ${cappedTotal} out of 100`}
      />
    </DialCard>
  );
}

function PillarDialCell({ stat }: { stat: BossPillarDialStat }) {
  const pctFill =
    stat.maxScore > 0 ? Math.min(100, Math.round((stat.sum / stat.maxScore) * 100)) : 0;

  return (
    <div className="flex min-w-0 flex-col items-center justify-center px-3 py-3 sm:px-5 sm:py-4">
      <RingGauge
        size="pillar"
        pctFill={pctFill}
        color={stat.color}
        centerPrimary={`${pctFill}`}
        percentSuffix
        ariaLabel={`${stat.label}: ${pctFill}% of pillar maximum, ${stat.sum} of ${stat.maxScore} points`}
      />
      <div className="mt-4 flex max-w-[9rem] flex-col items-center gap-1.5 text-center sm:mt-5">
        <span
          className="h-0.5 w-9 shrink-0 rounded-full"
          style={{ backgroundColor: stat.color }}
          aria-hidden
        />
        <span className="text-xs font-semibold leading-snug text-slate-700 sm:text-sm">
          {stat.label}
        </span>
      </div>
    </div>
  );
}

function PillarScoresPanel({
  pillarStats,
  className = "",
}: {
  pillarStats: BossPillarDialStat[];
  className?: string;
}) {
  return (
    <div className={`${DIAL_CARD_SHELL} flex min-w-0 flex-1 flex-col ${className}`}>
      <div className={CARD_HEADER}>Pillar scores</div>
      <div className="flex flex-1 items-center justify-center px-2 py-4 sm:px-3 sm:py-5">
        <div className="grid w-full grid-cols-2 sm:grid-cols-4">
          {pillarStats.map((stat) => (
            <PillarDialCell key={stat.pillarKey} stat={stat} />
          ))}
        </div>
      </div>
    </div>
  );
}

export type BossAnswerMixCounts = {
  onTrack: number;
  building: number;
  needsAttention: number;
  /** Playbooks with no score yet (excluded from on-track / building / needs-attention counts). */
  notAnswered?: number;
};

type AnswerMixBarProps = BossAnswerMixCounts & {
  className?: string;
  /** Slate card header label */
  title?: string;
};

const NOT_ANSWERED_GREY = "#cbd5e1";

const MIX_SEGMENTS = [
  { key: "onTrack", label: "On track", color: "#4ADE80" },
  { key: "building", label: "Building", color: "#E5C84A" },
  { key: "needsAttention", label: "Needs attention", color: "#C73E54" },
  { key: "notAnswered", label: "Not answered", color: NOT_ANSWERED_GREY },
] as const;

export function BossAnswerMixBar({
  onTrack,
  building,
  needsAttention,
  notAnswered = 0,
  className = "",
  title = "Progress",
}: AnswerMixBarProps) {
  const counts = {
    onTrack,
    building,
    needsAttention,
    notAnswered,
  };
  const total = onTrack + building + needsAttention + notAnswered;
  const w = (n: number) => `${(n / total) * 100}%`;

  const legendItems = MIX_SEGMENTS.filter(({ key }) => counts[key] > 0 || key !== "notAnswered");

  return (
    <DialCard
      header={title}
      className={`mx-auto w-full max-w-[40rem] ${className}`}
      bodyClassName="space-y-3 px-4 py-4 sm:px-5 sm:py-5"
    >
      {total <= 0 ? (
        <div
          className="h-4 w-full rounded-lg bg-slate-200/90"
          role="img"
          aria-label="No playbooks scored yet — progress will appear as you work through the grid."
        />
      ) : (
        <div
          className="flex h-4 w-full overflow-hidden rounded-lg shadow-inner ring-1 ring-slate-200/80"
          role="img"
          aria-label="Scoring progress bar"
        >
          {onTrack > 0 ? (
            <div style={{ width: w(onTrack), background: "#4ADE80" }} title={`On track: ${onTrack}`} />
          ) : null}
          {building > 0 ? (
            <div style={{ width: w(building), background: "#E5C84A" }} title={`Building: ${building}`} />
          ) : null}
          {needsAttention > 0 ? (
            <div
              style={{ width: w(needsAttention), background: "#C73E54" }}
              title={`Needs attention: ${needsAttention}`}
            />
          ) : null}
          {notAnswered > 0 ? (
            <div
              style={{ width: w(notAnswered), background: NOT_ANSWERED_GREY }}
              title={`Not answered: ${notAnswered}`}
            />
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
        {legendItems.map(({ key, label, color }) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            {label} <span className="font-semibold tabular-nums text-slate-900">{counts[key]}</span>
          </span>
        ))}
      </div>
    </DialCard>
  );
}

export function BossScoreDialStrip({ totalScore, pillarStats, className = "" }: BossScoreDialStripProps) {
  const cappedTotal = Math.min(100, Math.max(0, totalScore));
  const overallPct = Math.round(cappedTotal);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <BossScoreHeroCard
          cappedTotal={cappedTotal}
          overallPct={overallPct}
          className="mx-auto w-full max-w-[20rem] shrink-0 md:mx-0 md:w-[19.5rem]"
        />
        <PillarScoresPanel pillarStats={pillarStats} />
      </div>
    </div>
  );
}

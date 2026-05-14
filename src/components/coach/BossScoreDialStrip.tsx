"use client";

import type { BossPillarDialStat } from "@/lib/bossScores";

const TRACK_GREY = "#e8ecf1";
/** Overall grid dial accent (neutral, distinct from pillars). */
const OVERALL_COLOR = "#0c5280";

type BossScoreDialStripProps = {
  totalScore: number;
  pillarStats: BossPillarDialStat[];
  className?: string;
};

function RingDial({
  pctFill,
  color,
  centerPrimary,
  centerSecondary,
  label,
  subline,
  ariaLabel,
}: {
  pctFill: number;
  color: string;
  centerPrimary: string;
  centerSecondary?: string;
  label: string;
  subline?: string;
  ariaLabel: string;
}) {
  const sweepDeg = (Math.min(100, Math.max(0, pctFill)) / 100) * 360;

  return (
    <div className="flex min-w-0 flex-col items-center gap-3 border-slate-200/80 py-1 text-center sm:border-r sm:border-slate-200/80 sm:px-2 sm:last:border-r-0 md:px-3">
      <div
        className="relative h-[7.25rem] w-[7.25rem] shrink-0 sm:h-[8.25rem] sm:w-[8.25rem] md:h-[8.75rem] md:w-[8.75rem]"
        role="img"
        aria-label={ariaLabel}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${color} 0deg ${sweepDeg}deg, ${TRACK_GREY} ${sweepDeg}deg 360deg)`,
          }}
        />
        <div className="absolute inset-[12px] flex flex-col items-center justify-center rounded-full bg-white sm:inset-[14px] md:inset-[15px]">
          <span className="text-2xl font-bold tabular-nums leading-none tracking-tight text-slate-900 sm:text-3xl md:text-[2rem]">
            {centerPrimary}
          </span>
          {centerSecondary ? (
            <span className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-500 sm:text-xs">{centerSecondary}</span>
          ) : null}
        </div>
      </div>
      <div className="flex max-w-[9rem] flex-col items-center gap-1 px-0.5">
        <span className="h-0.5 w-9 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <span className="text-[17px] font-semibold leading-snug text-slate-800 sm:text-[18px]">{label}</span>
        {subline ? (
          <span className="text-[10px] leading-tight text-slate-500">{subline}</span>
        ) : null}
      </div>
    </div>
  );
}

type AnswerMixBarProps = {
  onTrack: number;
  building: number;
  needsAttention: number;
  /** Playbooks with no score yet (excluded from on-track / building / needs-attention counts). */
  notAnswered?: number;
};

const NOT_ANSWERED_GREY = "#cbd5e1";

export function BossAnswerMixBar({
  onTrack,
  building,
  needsAttention,
  notAnswered = 0,
}: AnswerMixBarProps) {
  const total = onTrack + building + needsAttention + notAnswered;
  if (total <= 0) {
    return (
      <div
        className="h-4 w-full rounded-lg bg-slate-200/90"
        role="img"
        aria-label="No playbooks to score — answer mix will appear when the matrix loads."
      />
    );
  }

  const w = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="w-full space-y-2">
      <div
        className="flex h-4 w-full overflow-hidden rounded-lg shadow-inner ring-1 ring-slate-200/80"
        role="img"
        aria-label="Answer mix bar chart including not answered"
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
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#4ADE80]" aria-hidden />
          On track <span className="font-semibold tabular-nums text-slate-900">{onTrack}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#E5C84A]" aria-hidden />
          Building <span className="font-semibold tabular-nums text-slate-900">{building}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#C73E54]" aria-hidden />
          Needs attention <span className="font-semibold tabular-nums text-slate-900">{needsAttention}</span>
        </span>
        {notAnswered > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" aria-hidden />
            Not answered <span className="font-semibold tabular-nums text-slate-900">{notAnswered}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function BossScoreDialStrip({ totalScore, pillarStats, className = "" }: BossScoreDialStripProps) {
  const cappedTotal = Math.min(100, Math.max(0, totalScore));
  const overallPct = Math.round(cappedTotal);

  return (
    <div className={`w-full ${className}`}>
      <div className="grid w-full grid-cols-5 gap-0 sm:gap-0">
        <RingDial
          pctFill={overallPct}
          color={OVERALL_COLOR}
          centerPrimary={`${cappedTotal}`}
          centerSecondary="/ 100"
          label="BOSS score"
          ariaLabel={`BOSS score ${cappedTotal} out of 100`}
        />
        {pillarStats.map((stat) => {
          const pctFill = stat.maxScore > 0 ? Math.min(100, Math.round((stat.sum / stat.maxScore) * 100)) : 0;
          return (
            <RingDial
              key={stat.pillarKey}
              pctFill={pctFill}
              color={stat.color}
              centerPrimary={`${pctFill}%`}
              label={stat.label}
              ariaLabel={`${stat.label}: ${pctFill}% of pillar maximum, ${stat.sum} of ${stat.maxScore} points`}
            />
          );
        })}
      </div>
    </div>
  );
}

"use client";

import type { PillarScores } from "@/lib/bossScores";

const DIAL_R = 42;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_R;
const MAX_PILLAR_SCORE = 30;

const PILLAR_DIALS = [
  {
    pillar: "vision" as const,
    label: "Clarify Vision",
    strokeClass: "stroke-[#0c5290]",
  },
  {
    pillar: "velocity" as const,
    label: "Control Velocity",
    strokeClass: "stroke-[#42a1ee]",
  },
  {
    pillar: "value" as const,
    label: "Create Value",
    strokeClass: "stroke-[#1ca0c2]",
  },
] as const;

const DIAL_CARD_SHELL =
  "overflow-hidden rounded-t-lg border border-b-0 border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]";

type SpeedDialsProps = {
  pillarScores: PillarScores;
  gridCols: string;
  "aria-label"?: string;
};

export function SpeedDials({ pillarScores, gridCols, "aria-label": ariaLabel }: SpeedDialsProps) {
  const scores = [
    pillarScores.vision,
    pillarScores.velocity,
    pillarScores.value,
  ] as const;

  return (
    <div
      className="mb-0 grid w-full gap-x-3 gap-y-0 py-2"
      style={{ gridTemplateColumns: gridCols }}
      role="img"
      aria-label={ariaLabel ?? "Pillar scores"}
    >
      <div />
      <div />
      {PILLAR_DIALS.map((dial, index) => (
        <DialCard
          key={dial.pillar}
          label={dial.label}
          score={scores[index]}
          strokeClass={dial.strokeClass}
        />
      ))}
    </div>
  );
}

function DialCard({
  label,
  score,
  strokeClass,
}: {
  label: string;
  score: number;
  strokeClass: string;
}) {
  return (
    <div className={DIAL_CARD_SHELL}>
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
        {label}
      </div>
      <div className="flex justify-center px-2 py-3">
        <SingleDial score={score} label={label} strokeClass={strokeClass} />
      </div>
    </div>
  );
}

function SingleDial({
  score,
  label,
  strokeClass,
}: {
  score: number;
  label: string;
  strokeClass: string;
}) {
  const pct = Math.round((score / MAX_PILLAR_SCORE) * 100);
  const dash = (score / MAX_PILLAR_SCORE) * DIAL_CIRCUMFERENCE;

  return (
    <div
      className="flex flex-shrink-0 flex-col items-center"
      role="img"
      aria-label={`${label}: ${pct}%`}
    >
      <svg className="h-[160px] w-[160px]" viewBox="0 0 100 100" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={DIAL_R}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={16}
        />
        <circle
          cx="50"
          cy="50"
          r={DIAL_R}
          fill="none"
          className={strokeClass}
          strokeWidth={16}
          strokeLinecap="butt"
          strokeDasharray={`${dash} ${DIAL_CIRCUMFERENCE}`}
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="55"
          textAnchor="middle"
          fill="#334155"
          fontSize="1.27rem"
          fontWeight="700"
        >
          <tspan>{pct}</tspan>
          <tspan fill="rgba(51,65,85,0.55)" fontSize="0.65em">
            %
          </tspan>
        </text>
      </svg>
    </div>
  );
}

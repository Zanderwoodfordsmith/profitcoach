"use client";

import type { PillarScores } from "@/lib/bossScores";

const DIAL_R = 42;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_R;
const MAX_PILLAR_SCORE = 30;

type SpeedDialsProps = {
  pillarScores: PillarScores;
  gridCols: string;
  "aria-label"?: string;
};

export function SpeedDials({ pillarScores, gridCols, "aria-label": ariaLabel }: SpeedDialsProps) {
  const dials: { pillar: keyof PillarScores; label: string; strokeClass: string }[] = [
    { pillar: "vision", label: "Clarify Vision", strokeClass: "stroke-[#0c5290]" },
    { pillar: "velocity", label: "Control Velocity", strokeClass: "stroke-[#42a1ee]" },
    { pillar: "value", label: "Create Value", strokeClass: "stroke-[#1ca0c2]" },
  ];

  return (
    <div
      className="grid w-full gap-x-3 gap-y-0 mb-0 py-2"
      style={{
        gridTemplateColumns: gridCols,
      }}
      role="img"
      aria-label={ariaLabel ?? "Pillar scores"}
    >
      <div />
      <div />
      <div className="flex justify-center items-center rounded-t-lg border-2 border-b-0 border-[#6d737a] bg-transparent px-2 py-6 shadow-sm">
        <SingleDial
          score={pillarScores.vision}
          label={dials[0].label}
          strokeClass={dials[0].strokeClass}
        />
      </div>
      <div className="flex justify-center items-center rounded-t-lg border-2 border-b-0 border-[#6d737a] bg-transparent px-2 py-6 shadow-sm">
        <SingleDial
          score={pillarScores.velocity}
          label={dials[1].label}
          strokeClass={dials[1].strokeClass}
        />
      </div>
      <div className="flex justify-center items-center rounded-t-lg border-2 border-b-0 border-[#6d737a] bg-transparent px-2 py-6 shadow-sm">
        <SingleDial
          score={pillarScores.value}
          label={dials[2].label}
          strokeClass={dials[2].strokeClass}
        />
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
    <div className="flex flex-col items-center flex-shrink-0" role="img" aria-label={`${label}: ${pct}%`}>
      <svg
        className="h-[173px] w-[173px]"
        viewBox="0 0 100 100"
        aria-hidden
      >
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
        <text x="50" y="55" textAnchor="middle" fill="#334155" fontSize="1.27rem" fontWeight="700">
          <tspan>{pct}</tspan>
          <tspan fill="rgba(51,65,85,0.55)" fontSize="0.65em">%</tspan>
        </text>
      </svg>
      <span className="mt-1.5 text-[1.3rem] leading-tight text-slate-500">{label}</span>
    </div>
  );
}

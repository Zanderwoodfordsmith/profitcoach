"use client";

import { PLAYBOOK_COUNT } from "@/lib/bossData";
import { computeScoreBreakdown, type AnswersMap } from "@/lib/bossScores";
import { wedgePath } from "./wedgePath";

const DOUGHNUT_CX = 100;
const DOUGHNUT_CY = 100;
const DOUGHNUT_R_INNER = 50;
const DOUGHNUT_R_OUTER = 95;

const SEGMENT_COLORS = ["#b7e1cd", "#fce8b2", "#f4c7c3", "#e2e8f0"];
const SEGMENT_LABELS = [
  "Fully in place",
  "Partially in place",
  "Not in place",
  "Not answered",
];

type BossDoughnutProps = {
  scores: AnswersMap;
  "aria-label"?: string;
};

export function BossDoughnut({
  scores,
  "aria-label": ariaLabel,
}: BossDoughnutProps) {
  const breakdown = computeScoreBreakdown(scores);
  const counts = [
    breakdown.green,
    breakdown.amber,
    breakdown.red,
    breakdown.unanswered,
  ];

  const startAngle = -Math.PI / 2;

  const segments = counts.reduce<
    { startAngle: number; endAngle: number; count: number; color: string }[]
  >((acc, count, i) => {
    const segmentAngle = (count / PLAYBOOK_COUNT) * 2 * Math.PI;
    const prevEnd = acc.length > 0 ? acc[acc.length - 1].endAngle : startAngle;
    acc.push({
      startAngle: prevEnd,
      endAngle: prevEnd + segmentAngle,
      count,
      color: SEGMENT_COLORS[i],
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          Score breakdown
        </h2>
        <svg
          viewBox="0 0 200 200"
          className="w-48 h-48"
          role="img"
          aria-label={ariaLabel ?? "Score breakdown doughnut"}
        >
          <circle
            cx={DOUGHNUT_CX}
            cy={DOUGHNUT_CY}
            r={DOUGHNUT_R_OUTER}
            fill="#ffffff"
          />
          <g>
            {segments.map((seg, i) => {
              const d =
                seg.count <= 0
                  ? `M ${DOUGHNUT_CX} ${DOUGHNUT_CY}`
                  : wedgePath(
                      DOUGHNUT_CX,
                      DOUGHNUT_CY,
                      DOUGHNUT_R_INNER,
                      DOUGHNUT_R_OUTER,
                      seg.startAngle,
                      seg.endAngle
                    );
              return <path key={i} d={d} fill={seg.color} />;
            })}
          </g>
        </svg>
      </div>
      <div className="space-y-1.5 text-sm">
        {SEGMENT_LABELS.map((label, i) => {
          const pct = Math.round((counts[i] / PLAYBOOK_COUNT) * 100);
          return (
            <div
              key={label}
              className="flex items-center gap-2 text-slate-700"
            >
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: SEGMENT_COLORS[i] }}
              />
              <span>
                {label} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { WHEEL_COLORS } from "@/lib/bossData";
import { wedgePath } from "./wedgePath";

const WHEEL_CX = 482;
const WHEEL_CY = 482;
const WHEEL_R_INNER = 39;
const WHEEL_R_RING_INNER = 386;
const WHEEL_R_RING_OUTER = 444;
const WHEEL_SEGMENTS = 10;

const AREA_NAMES = [
  "Owner Performance",
  "Aligned Vision",
  "Defined Strategy",
  "Disciplined Planning",
  "Profit & Cash Flow",
  "Revenue & Marketing",
  "Operations & Delivery",
  "Financials & Metrics",
  "Infrastructure & Systems",
  "Team & Leadership",
];

const PILLAR_GROUPS = [
  { name: "Foundation", indices: [0], color: "#c026d3" },
  { name: "Vision", indices: [1, 2, 3], color: "#0c5290" },
  { name: "Velocity", indices: [4, 5, 6], color: "#42a1ee" },
  { name: "Value", indices: [7, 8, 9], color: "#1ca0c2" },
];

type BossWheelProps = {
  areaScores: number[];
  totalScore?: number;
  "aria-label"?: string;
};

export function BossWheel({
  areaScores,
  totalScore,
  "aria-label": ariaLabel,
}: BossWheelProps) {
  const startAngle = -Math.PI / 2;
  const step = (2 * Math.PI) / WHEEL_SEGMENTS;

  return (
    <div className="flex flex-col items-center gap-4">
      {totalScore != null && (
        <div className="text-center">
          <span className="block text-3xl font-bold text-slate-900">{totalScore}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            BOSS SCORE
          </span>
        </div>
      )}
      <svg
        viewBox="0 0 965 965"
        className="w-full max-w-[400px] h-auto"
        role="img"
        aria-label={ariaLabel ?? "Area scores wheel"}
      >
        <circle
          cx={WHEEL_CX}
          cy={WHEEL_CY}
          r={WHEEL_R_RING_OUTER}
          fill="#ffffff"
        />
        {Array.from({ length: 10 }, (_, level) => {
          const radius =
            WHEEL_R_INNER +
            ((level + 1) / 10) * (WHEEL_R_RING_INNER - WHEEL_R_INNER);
          return (
            <circle
              key={level}
              cx={WHEEL_CX}
              cy={WHEEL_CY}
              r={radius}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
          );
        })}
        {Array.from({ length: WHEEL_SEGMENTS }, (_, i) => {
          const angle = startAngle + i * step;
          const x1 = WHEEL_CX + WHEEL_R_INNER * Math.cos(angle);
          const y1 = WHEEL_CY + WHEEL_R_INNER * Math.sin(angle);
          const x2 = WHEEL_CX + WHEEL_R_RING_OUTER * Math.cos(angle);
          const y2 = WHEEL_CY + WHEEL_R_RING_OUTER * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#e2e8f0"
              strokeWidth={1}
              strokeOpacity={0.6}
            />
          );
        })}
        {Array.from({ length: WHEEL_SEGMENTS }, (_, i) => {
          const a0 = startAngle + i * step;
          const a1 = startAngle + (i + 1) * step;
          const score = areaScores[i] ?? 0;
          const rFilled =
            score <= 0
              ? WHEEL_R_INNER
              : WHEEL_R_INNER +
                (score / 10) * (WHEEL_R_RING_INNER - WHEEL_R_INNER);

          return (
            <g key={i}>
              <path
                d={wedgePath(
                  WHEEL_CX,
                  WHEEL_CY,
                  WHEEL_R_INNER,
                  WHEEL_R_RING_INNER,
                  a0,
                  a1
                )}
                fill="#ffffff"
                stroke={WHEEL_COLORS[i]}
                strokeWidth={1}
                strokeOpacity={0.2}
              />
              <path
                d={wedgePath(
                  WHEEL_CX,
                  WHEEL_CY,
                  WHEEL_R_INNER,
                  rFilled,
                  a0,
                  a1
                )}
                fill={WHEEL_COLORS[i]}
              />
              <path
                d={wedgePath(
                  WHEEL_CX,
                  WHEEL_CY,
                  WHEEL_R_RING_INNER,
                  WHEEL_R_RING_OUTER,
                  a0,
                  a1
                )}
                fill={WHEEL_COLORS[i]}
              />
            </g>
          );
        })}
      </svg>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
        {PILLAR_GROUPS.map((group) => (
          <div key={group.name} className="space-y-1">
            <div
              className="font-semibold text-sm"
              style={{ color: group.color }}
            >
              {group.name}
            </div>
            {group.indices.map((idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-slate-700"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: WHEEL_COLORS[idx] }}
                />
                <span>
                  {AREA_NAMES[idx]} ({areaScores[idx] ?? 0})
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

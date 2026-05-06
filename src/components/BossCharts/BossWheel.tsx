"use client";

import { WHEEL_COLORS, WHEEL_COLORS_ALT, LEVEL_COLORS_DIAGRAM } from "@/lib/bossData";
import { LEVELS } from "@/lib/bossData";
import { computeLevelScores } from "@/lib/bossScores";
import type { AnswersMap } from "@/lib/bossScores";
import { wedgePath } from "./wedgePath";

const WHEEL_CX = 482;
const WHEEL_CY = 482;
const WHEEL_R_INNER = 0;
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

/** Arc path for textPath - reversed on lower half so text reads right-side up */
function arcPathForSegment(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  isUpperHalf: boolean
): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  // Upper half: arc a0→a1 clockwise (sweep=1). Lower half: a1→a0 ccw (sweep=0) to flip text.
  if (isUpperHalf) {
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  }
  return `M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x0} ${y0}`;
}

const LABEL_R = (WHEEL_R_RING_INNER + WHEEL_R_RING_OUTER) / 2;
// Small offset to nudge upper/lower text further toward center of arch band
const LABEL_OFFSET = 5;
// For 10 areas: tighter arc (more curve) + outward shift to keep centered
const LABEL_CURVE_AREAS = 30;

const PILLAR_NAMES = ["Foundation", "Vision", "Velocity", "Value"];

const LEVEL_NAMES = LEVELS.map((l) => l.name).reverse(); // Overwhelm first: [Overwhelm, Overworked, Organised, Overseer, Owner]

function computePillarScores(areaScores: number[]): number[] {
  return PILLAR_GROUPS.map((group) => {
    const vals = group.indices.map((i) => areaScores[i] ?? 0).filter((v) => v >= 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
}

function computeLevelScoresForWheel(answers: AnswersMap | null | undefined): number[] {
  const raw = computeLevelScores(answers);
  return raw.map((r) => r.sum / 2); // 0-20 → 0-10
}

type BossWheelProps = {
  areaScores: number[];
  totalScore?: number;
  /** Required when viewMode is "levels" */
  answers?: AnswersMap | null;
  "aria-label"?: string;
  /** "default" = blue/purple palette, "alt" = warm coral/yellow/green palette (ignored when viewMode is "levels") */
  colorScheme?: "default" | "alt";
  /** "areas" = 10 segments, "pillars" = 4 segments, "levels" = 5 segments with diagram colors */
  viewMode?: "areas" | "pillars" | "levels";
  /** When false, hides the pillar/area legend column (e.g. marketing hero). Default true. */
  showLegend?: boolean;
};

export function BossWheel({
  areaScores,
  totalScore,
  answers,
  "aria-label": ariaLabel,
  colorScheme = "default",
  viewMode = "areas",
  showLegend = true,
}: BossWheelProps) {
  const colors = colorScheme === "alt" ? WHEEL_COLORS_ALT : WHEEL_COLORS;
  const isPillarView = viewMode === "pillars";
  const isLevelView = viewMode === "levels";
  const segmentCount = isLevelView ? 5 : isPillarView ? 4 : 10;
  const segmentScores = isLevelView
    ? computeLevelScoresForWheel(answers)
    : isPillarView
      ? computePillarScores(areaScores)
      : areaScores;
  const segmentNames = isLevelView ? LEVEL_NAMES : isPillarView ? PILLAR_NAMES : AREA_NAMES;
  const segmentColors = isLevelView
    ? LEVEL_COLORS_DIAGRAM
    : isPillarView
      ? PILLAR_GROUPS.map((g) => colors[g.indices[0]])
      : colors;
  const useCurvedLabels = !isLevelView && !isPillarView;
  const labelArcR = useCurvedLabels ? LABEL_R - LABEL_CURVE_AREAS : LABEL_R;
  const labelOutwardShift = useCurvedLabels ? LABEL_CURVE_AREAS : 0;
  const startAngle = -Math.PI / 2;
  const step = (2 * Math.PI) / segmentCount;

  return (
    <div className="flex flex-wrap items-end justify-center gap-8 md:gap-12">
      {totalScore != null && (
        <div className="flex flex-col items-center shrink-0 order-2 md:order-1 pb-2">
          <span className="block text-4xl font-bold text-slate-500">{totalScore}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            BOSS SCORE
          </span>
        </div>
      )}
      <div className="shrink-0 order-1 md:order-2 w-[320px] sm:w-[400px] md:w-[520px] lg:w-[600px]">
      <svg
        viewBox="0 0 965 965"
        className="w-full h-auto"
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
              strokeOpacity={0.3}
            />
          );
        })}
        {Array.from({ length: segmentCount }, (_, i) => {
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
              strokeOpacity={0.05}
            />
          );
        })}
        {Array.from({ length: segmentCount }, (_, i) => {
          const a0 = startAngle + i * step;
          const a1 = startAngle + (i + 1) * step;
          const score = segmentScores[i] ?? 0;
          const rFilled =
            score <= 0
              ? WHEEL_R_INNER
              : WHEEL_R_INNER +
                (score / 10) * (WHEEL_R_RING_INNER - WHEEL_R_INNER);

          const gradR = Math.max(rFilled, 1);
          return (
            <g key={i}>
              <defs>
                <radialGradient
                  id={`slice-grad-${i}`}
                  gradientUnits="userSpaceOnUse"
                  cx={WHEEL_CX}
                  cy={WHEEL_CY}
                  r={gradR}
                >
                  <stop offset="0%" stopColor={segmentColors[i]} stopOpacity="0.6" />
                  <stop offset="100%" stopColor={segmentColors[i]} />
                </radialGradient>
              </defs>
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
                stroke={segmentColors[i]}
                strokeWidth={1}
                strokeOpacity={0.05}
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
                fill={`url(#slice-grad-${i})`}
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
                fill={segmentColors[i]}
              />
            </g>
          );
        })}
        <defs>
          {Array.from({ length: segmentCount }, (_, i) => {
            const a0 = startAngle + i * step;
            const a1 = startAngle + (i + 1) * step;
            const midAngle = startAngle + (i + 0.5) * step;
            const isUpperHalf = Math.sin(midAngle) < 0;
            return (
              <path
                key={i}
                id={`wheel-label-${i}`}
                d={arcPathForSegment(
                  WHEEL_CX,
                  WHEEL_CY,
                  isUpperHalf ? labelArcR - LABEL_OFFSET : labelArcR + LABEL_OFFSET,
                  a0,
                  a1,
                  isUpperHalf
                )}
                fill="none"
              />
            );
          })}
        </defs>
        {Array.from({ length: segmentCount }, (_, i) => {
          const midAngle = startAngle + (i + 0.5) * step;
          const dx = labelOutwardShift * Math.cos(midAngle);
          const dy = labelOutwardShift * Math.sin(midAngle);
          const textEl = (
            <text
              key={i}
              fontSize="20"
              fontWeight="500"
              fill="#ffffff"
              style={{
                textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                letterSpacing: "-0.3px",
              }}
            >
              <textPath
                href={`#wheel-label-${i}`}
                startOffset="50%"
                textAnchor="middle"
              >
                {segmentNames[i]}
              </textPath>
            </text>
          );
          return labelOutwardShift ? (
            <g key={i} transform={`translate(${dx}, ${dy})`}>
              {textEl}
            </g>
          ) : (
            textEl
          );
        })}
        {Array.from({ length: segmentCount }, (_, i) => {
          const midAngle = startAngle + (i + 0.5) * step;
          const score = segmentScores[i] ?? 0;
          const rFilled =
            score <= 0
              ? WHEEL_R_INNER
              : WHEEL_R_INNER +
                (score / 10) * (WHEEL_R_RING_INNER - WHEEL_R_INNER);
          const pct = Math.round(score * 10);
          const isLowScore = pct <= 10;
          // Inside color: ~72% into filled wedge (slightly toward outer edge); low scores go outside
          const scoreR = isLowScore
            ? Math.max(rFilled, WHEEL_R_INNER + 55) + 25
            : WHEEL_R_INNER + (rFilled - WHEEL_R_INNER) * 0.72;
          const x = WHEEL_CX + scoreR * Math.cos(midAngle);
          const y = WHEEL_CY + scoreR * Math.sin(midAngle);
          return (
            <text
              key={`score-${i}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isLowScore ? "#475569" : "rgba(255,255,255,0.8)"}
              style={{
                textShadow: isLowScore
                  ? "0 1px 1px rgba(255,255,255,0.5)"
                  : "0 1px 2px rgba(0,0,0,0.35)",
              }}
            >
              <tspan fontSize="28" fontWeight="500">
                {pct}
              </tspan>
              <tspan fontSize="14" fontWeight="500">
                %
              </tspan>
            </text>
          );
        })}
      </svg>
      </div>
      {showLegend ? (
      <div className="flex flex-col gap-4 shrink-0 order-3 text-sm pb-2">
        {isLevelView ? (
          LEVEL_NAMES.map((name, i) => {
            const s = segmentScores[i] ?? 0;
            const pct = Math.round(s * 10);
            return (
              <div key={name} className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: segmentColors[i] }}
                />
                <span className="text-slate-700">
                  {name} ({pct}%)
                </span>
              </div>
            );
          })
        ) : isPillarView ? (
          PILLAR_GROUPS.map((group, i) => {
            const s = segmentScores[i] ?? 0;
            const pct = Math.round(s * 10);
            return (
              <div key={group.name} className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: segmentColors[i] }}
                />
                <span className="text-slate-700">
                  {group.name} ({pct}%)
                </span>
              </div>
            );
          })
        ) : (
          PILLAR_GROUPS.map((group) => (
            <div key={group.name} className="space-y-1">
              <div
                className="font-semibold text-xs uppercase tracking-wide"
                style={{ color: colors[group.indices[0]] }}
              >
                {group.name.toUpperCase()}
              </div>
              {group.indices.map((idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-slate-700"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: colors[idx] }}
                  />
                  <span>
                    {AREA_NAMES[idx]} ({areaScores[idx] ?? 0})
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      ) : null}
    </div>
  );
}

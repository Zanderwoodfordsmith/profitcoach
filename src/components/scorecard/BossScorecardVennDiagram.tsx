"use client";

import {
  SCORECARD_PILLAR_META,
  SCORECARD_QUESTIONS,
  VENN_PETAL_QUESTIONS,
} from "@/lib/bossScorecardQuestions";
import {
  scoreToPastelColor,
  scoreToPastelLensColor,
  type OutcomeScores,
  type ScorecardAnswers,
  type ScorecardScore,
} from "@/lib/bossScorecardScores";
import { splitAreaTitleForDiagram } from "@/lib/scorecardAreaPlaybooks";

const cx = 500;
const cy = 500;
const rC = 200;
const oC = 130;
const ANGLES = [-90, 30, 150];
const PETAL_SPAN = 60;
const PETAL_GAP = 0;
const SLOT_OFFSETS = [-(PETAL_SPAN + PETAL_GAP), 0, PETAL_SPAN + PETAL_GAP];
const PETAL_INNER = rC;
const PETAL_OUTER = rC + 88;

const LENS_CORE_NAVY = "#1f3a66";
const LENS_STROKE = "rgba(22, 45, 80, 0.65)";
const TEXT_ON_PETAL = "#1f3a66";
const TEXT_ON_FILL = "#ffffff";
const TEXT_ON_LENS = "#f8fafc";
const TEXT_ON_LENS_MUTED = "rgba(248, 250, 252, 0.82)";
const TEXT_MUTED = "rgba(31, 58, 102, 0.55)";

type PillarKey = "vision" | "velocity" | "value";

type PillarGeom = {
  id: PillarKey;
  title: string;
  green: string;
  red: string;
  color: string;
  angle: number;
  pos: { x: number; y: number };
};

const PILLAR_ORDER: PillarKey[] = ["vision", "velocity", "value"];

/** Stable SVG number formatting — avoids SSR/client float drift hydration mismatches. */
function svgN(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function pillarPos(angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.round((cx + oC * Math.cos(rad)) * 100) / 100,
    y: Math.round((cy + oC * Math.sin(rad)) * 100) / 100,
  };
}

function petalPath(pillar: PillarGeom, slotIndex: number, pillars: PillarGeom[]) {
  const aCenter = pillar.angle + SLOT_OFFSETS[slotIndex];
  const a1 = aCenter - PETAL_SPAN / 2;
  const a2 = aCenter + PETAL_SPAN / 2;
  const r1 = PETAL_INNER;
  const r2 = PETAL_OUTER;
  const r1a = (a1 * Math.PI) / 180;
  const r2a = (a2 * Math.PI) / 180;
  let x1 = pillar.pos.x + r1 * Math.cos(r1a);
  let y1 = pillar.pos.y + r1 * Math.sin(r1a);
  let x2 = pillar.pos.x + r2 * Math.cos(r1a);
  let y2 = pillar.pos.y + r2 * Math.sin(r1a);
  let x3 = pillar.pos.x + r2 * Math.cos(r2a);
  let y3 = pillar.pos.y + r2 * Math.sin(r2a);
  let x4 = pillar.pos.x + r1 * Math.cos(r2a);
  let y4 = pillar.pos.y + r1 * Math.sin(r2a);

  function snapToSharedLine(neighbourIdx: number, isA1Edge: boolean) {
    const N = pillars[neighbourIdx].pos;
    const mx = (pillar.pos.x + N.x) / 2 - cx;
    const my = (pillar.pos.y + N.y) / 2 - cy;
    const mLen = Math.sqrt(mx * mx + my * my) || 1;
    const dirX = mx / mLen;
    const dirY = my / mLen;
    const px = pillar.pos.x - cx;
    const py = pillar.pos.y - cy;
    const b = -2 * (dirX * px + dirY * py);
    const cInner = px * px + py * py - r1 * r1;
    const cOuter = px * px + py * py - r2 * r2;
    function solve(c: number) {
      const disc = b * b - 4 * c;
      if (disc < 0) return null;
      const t = (-b + Math.sqrt(disc)) / 2;
      return { x: cx + t * dirX, y: cy + t * dirY };
    }
    const inner = solve(cInner);
    const outer = solve(cOuter);
    if (!inner || !outer) return;
    if (isA1Edge) {
      x1 = inner.x;
      y1 = inner.y;
      x2 = outer.x;
      y2 = outer.y;
    } else {
      x3 = outer.x;
      y3 = outer.y;
      x4 = inner.x;
      y4 = inner.y;
    }
  }

  const pillarIdx = pillars.indexOf(pillar);
  if (pillarIdx >= 0) {
    if (slotIndex === 0) snapToSharedLine((pillarIdx + 2) % 3, true);
    if (slotIndex === 2) snapToSharedLine((pillarIdx + 1) % 3, false);
  }

  return `M ${svgN(x1)} ${svgN(y1)} L ${svgN(x2)} ${svgN(y2)} A ${r2} ${r2} 0 0 1 ${svgN(x3)} ${svgN(y3)} L ${svgN(x4)} ${svgN(y4)} A ${r1} ${r1} 0 0 0 ${svgN(x1)} ${svgN(y1)} Z`;
}

function lensPath(i: number, j: number, pillars: PillarGeom[]) {
  const A = pillars[i].pos;
  const B = pillars[j].pos;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const a = d / 2;
  const h = Math.sqrt(rC * rC - a * a);
  const px = A.x + dx * 0.5;
  const py = A.y + dy * 0.5;
  const ox = (-dy / d) * h;
  const oy = (dx / d) * h;
  const p1 = { x: px + ox, y: py + oy };
  const p2 = { x: px - ox, y: py - oy };
  return `M ${svgN(p1.x)} ${svgN(p1.y)} A ${rC} ${rC} 0 0 0 ${svgN(p2.x)} ${svgN(p2.y)} A ${rC} ${rC} 0 0 0 ${svgN(p1.x)} ${svgN(p1.y)} Z`;
}

function arcPath(
  cxP: number,
  cyP: number,
  rr: number,
  a1r: number,
  a2r: number,
  isLower: boolean
): string {
  const ax1 = cxP + rr * Math.cos(a1r);
  const ay1 = cyP + rr * Math.sin(a1r);
  const ax2 = cxP + rr * Math.cos(a2r);
  const ay2 = cyP + rr * Math.sin(a2r);
  return isLower
    ? `M ${svgN(ax2)} ${svgN(ay2)} A ${rr} ${rr} 0 0 0 ${svgN(ax1)} ${svgN(ay1)}`
    : `M ${svgN(ax1)} ${svgN(ay1)} A ${rr} ${rr} 0 0 1 ${svgN(ax2)} ${svgN(ay2)}`;
}

function getAreaName(id: string): string {
  return SCORECARD_QUESTIONS.find((q) => q.id === id)?.areaName ?? id;
}

function petalFill(answers: ScorecardAnswers, questionId: string): string {
  const score = answers[questionId];
  if (score == null) return "#ffffff";
  return scoreToPastelColor(score);
}

function lensFill(score: ScorecardScore | null): { fill: string; opacity: number } {
  if (score == null) return { fill: LENS_CORE_NAVY, opacity: 1 };
  return { fill: scoreToPastelLensColor(score), opacity: 0.88 };
}

export function BossScorecardVennDiagram({
  answers,
  outcomeScores,
}: {
  answers: ScorecardAnswers;
  outcomeScores: OutcomeScores;
}) {
  const pillars: PillarGeom[] = PILLAR_ORDER.map((id, i) => {
    const meta = SCORECARD_PILLAR_META[id];
    const a = ANGLES[i];
    return {
      id,
      title: meta.title,
      green: meta.green,
      red: meta.red,
      color: meta.color,
      angle: a,
      pos: pillarPos(a),
    };
  });

  const lensPairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 2],
  ];
  const lensLabels = ["Money", "Time", "Team"];
  const lensScores: (ScorecardScore | null)[] = [
    outcomeScores.money,
    outcomeScores.time,
    outcomeScores.team,
  ];

  const vb = "75 75 850 850";

  return (
    <svg
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      className="mx-auto h-auto w-full max-w-[min(100%,38rem)] sm:max-w-[min(100%,46rem)] lg:max-w-[52rem]"
      role="img"
      aria-label="BOSS Scorecard compass: Vision, Velocity, Value, with Money, Time, and Team outcomes toward your ideal business"
    >
      {pillars.flatMap((p, pi) => {
        const pillarKey = PILLAR_ORDER[pi];
        const questionIds = VENN_PETAL_QUESTIONS[pillarKey];
        return [0, 1, 2].map((mi) => (
          <path
            key={`petal-${p.id}-${mi}`}
            d={petalPath(p, mi, pillars)}
            fill={petalFill(answers, questionIds[mi])}
            stroke="rgba(31,58,102,0.14)"
            strokeWidth={0.9}
          />
        ));
      })}

      {pillars.map((p) => (
        <circle
          key={p.id}
          cx={p.pos.x}
          cy={p.pos.y}
          r={rC}
          fill={p.color}
          stroke="#ffffff"
          strokeWidth={2}
        />
      ))}

      {lensPairs.map(([i, j], k) => {
        const { fill, opacity } = lensFill(lensScores[k]);
        return (
          <path
            key={`lens-${k}`}
            d={lensPath(i, j, pillars)}
            fill={fill}
            fillOpacity={opacity}
            stroke={LENS_STROKE}
            strokeWidth={1}
          />
        );
      })}

      {(() => {
        const pairs = [
          [0, 1],
          [1, 2],
          [0, 2],
        ] as const;
        const innerPts = pairs.map(([i, j]) => {
          const A = pillars[i].pos;
          const B = pillars[j].pos;
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const a = d / 2;
          const h = Math.sqrt(rC * rC - a * a);
          const mx = A.x + dx * 0.5;
          const my = A.y + dy * 0.5;
          const ox = (-dy / d) * h;
          const oy = (dx / d) * h;
          const cand1 = { x: mx + ox, y: my + oy };
          const cand2 = { x: mx - ox, y: my - oy };
          const d1 = (cand1.x - cx) ** 2 + (cand1.y - cy) ** 2;
          const d2 = (cand2.x - cx) ** 2 + (cand2.y - cy) ** 2;
          return d1 < d2 ? cand1 : cand2;
        });
        const ordered = innerPts
          .slice()
          .sort(
            (a, b) =>
              Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
          );
        const [P1, P2, P3] = ordered;
        const path = `M ${svgN(P1.x)} ${svgN(P1.y)} A ${rC} ${rC} 0 0 1 ${svgN(P2.x)} ${svgN(P2.y)} A ${rC} ${rC} 0 0 1 ${svgN(P3.x)} ${svgN(P3.y)} A ${rC} ${rC} 0 0 1 ${svgN(P1.x)} ${svgN(P1.y)} Z`;
        return (
          <path
            d={path}
            fill="#ffffff"
            stroke="rgba(31,58,102,0.12)"
            strokeWidth={1}
          />
        );
      })()}

      {pillars.flatMap((p) =>
        [0, 1, 2].map((mi) => (
          <path
            key={`petal-stroke-${p.id}-${mi}`}
            d={petalPath(p, mi, pillars)}
            fill="none"
            stroke="rgba(31,58,102,0.14)"
            strokeWidth={0.9}
          />
        ))
      )}

      {pillars.map((p) => (
        <circle
          key={`${p.id}-stroke`}
          cx={p.pos.x}
          cy={p.pos.y}
          r={rC}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2}
        />
      ))}

      {lensLabels.map((label, lensIdx) => {
        const [i, j] = lensPairs[lensIdx]!;
        const A = pillars[i].pos;
        const B = pillars[j].pos;
        const mx = (A.x + B.x) / 2;
        const my = (A.y + B.y) / 2;
        const toCentreX = cx - mx;
        const toCentreY = cy - my;
        const tcLen = Math.sqrt(toCentreX * toCentreX + toCentreY * toCentreY) || 1;
        const ux = -toCentreX / tcLen;
        const uy = -toCentreY / tcLen;
        const offset = 66;
        const x = mx + ux * offset;
        const y = my + uy * offset;
        return (
          <g key={label}>
            <text
              x={svgN(x)}
              y={svgN(y + 2)}
              textAnchor="middle"
              fill={TEXT_ON_LENS}
              style={{
                font: '700 15px system-ui, "Segoe UI", sans-serif',
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                paintOrder: "stroke fill",
                stroke: "rgba(15, 23, 42, 0.35)",
                strokeWidth: 3,
                strokeLinejoin: "round",
              }}
            >
              {label}
            </text>
          </g>
        );
      })}

      {pillars.flatMap((p, pi) => {
        const pillarKey = PILLAR_ORDER[pi];
        const questionIds = VENN_PETAL_QUESTIONS[pillarKey];
        return [0, 1, 2].map((mi) => {
          const num = String(pi * 3 + mi + 1);
          const title = getAreaName(questionIds[mi]);
          const { line1, line2 } = splitAreaTitleForDiagram(title);
          const aCenter = p.angle + SLOT_OFFSETS[mi];
          const span = PETAL_SPAN - 6;
          const a1 = aCenter - span / 2;
          const a2 = aCenter + span / 2;
          const a1r = (a1 * Math.PI) / 180;
          const a2r = (a2 * Math.PI) / 180;
          const isLower = Math.sin((aCenter * Math.PI) / 180) > 0;
          const titleLineSpread = 8;
          const rOuter = (PETAL_INNER + PETAL_OUTER) / 2 + titleLineSpread - 4;
          const rInner = (PETAL_INNER + PETAL_OUTER) / 2 - titleLineSpread - 4;
          const rLine1 = isLower ? rInner : rOuter;
          const rLine2 = isLower ? rOuter : rInner;
          const rNum = isLower ? PETAL_INNER + 12 : PETAL_OUTER - 22;
          const fontStyle = {
            font: '600 16px system-ui, "Segoe UI", sans-serif',
            letterSpacing: "0.01em",
          };
          const numStyle = {
            font: '500 9px ui-monospace, monospace',
            letterSpacing: "0.14em",
            opacity: 0.45,
          };

          if (!line2) {
            const rMid = (PETAL_INNER + PETAL_OUTER) / 2 - 4;
            return (
              <g key={`petal-text-${p.id}-${mi}`}>
                <path
                  id={`bs-pt-mid-${p.id}-${mi}`}
                  d={arcPath(p.pos.x, p.pos.y, rMid, a1r, a2r, isLower)}
                  fill="none"
                />
                <text fill={TEXT_ON_PETAL} style={fontStyle}>
                  <textPath
                    href={`#bs-pt-mid-${p.id}-${mi}`}
                    startOffset="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {line1}
                  </textPath>
                </text>
                <path
                  id={`bs-pt-num-${p.id}-${mi}`}
                  d={arcPath(p.pos.x, p.pos.y, rNum, a1r, a2r, isLower)}
                  fill="none"
                />
                <text fill={TEXT_ON_PETAL} style={numStyle}>
                  <textPath
                    href={`#bs-pt-num-${p.id}-${mi}`}
                    startOffset="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {num}
                  </textPath>
                </text>
              </g>
            );
          }

          return (
            <g key={`petal-text-${p.id}-${mi}`}>
              <path
                id={`bs-pt-l1-${p.id}-${mi}`}
                d={arcPath(p.pos.x, p.pos.y, rLine1, a1r, a2r, isLower)}
                fill="none"
              />
              <path
                id={`bs-pt-l2-${p.id}-${mi}`}
                d={arcPath(p.pos.x, p.pos.y, rLine2, a1r, a2r, isLower)}
                fill="none"
              />
              <text fill={TEXT_ON_PETAL} style={fontStyle}>
                <textPath
                  href={`#bs-pt-l1-${p.id}-${mi}`}
                  startOffset="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {line1}
                </textPath>
              </text>
              <text fill={TEXT_ON_PETAL} style={fontStyle}>
                <textPath
                  href={`#bs-pt-l2-${p.id}-${mi}`}
                  startOffset="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {line2}
                </textPath>
              </text>
              <path
                id={`bs-pt-num-${p.id}-${mi}`}
                d={arcPath(p.pos.x, p.pos.y, rNum, a1r, a2r, isLower)}
                fill="none"
              />
              <text fill={TEXT_ON_PETAL} style={numStyle}>
                <textPath
                  href={`#bs-pt-num-${p.id}-${mi}`}
                  startOffset="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {num}
                </textPath>
              </text>
            </g>
          );
        });
      })}

      {pillars.map((p) => {
        const dx = p.pos.x - cx;
        const dy = p.pos.y - cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;
        const tx = p.pos.x + ux * (rC * 0.4);
        const ty = p.pos.y + uy * (rC * 0.4);
        const txN = svgN(tx);
        return (
          <g key={`${p.id}-c`}>
            <text
              x={txN}
              y={svgN(ty - 8)}
              textAnchor="middle"
              fill={TEXT_ON_FILL}
              style={{
                font: '600 24px system-ui, "Segoe UI", sans-serif',
                letterSpacing: "0.14em",
              }}
            >
              {p.title}
            </text>
            <text
              x={txN}
              y={svgN(ty + 22)}
              textAnchor="middle"
              fill={TEXT_ON_FILL}
              style={{
                font: '400 16px system-ui, "Segoe UI", sans-serif',
                fontStyle: "italic",
              }}
            >
              <tspan x={txN} dy="0">
                {p.green}
              </tspan>
              <tspan
                x={txN}
                dy="22"
                style={{ opacity: 0.82, fontStyle: "normal", fontSize: 13 }}
              >
                not {p.red}
              </tspan>
            </text>
          </g>
        );
      })}

      <g aria-hidden style={{ pointerEvents: "none" }}>
        <text
          x={cx}
          y={cy - 26}
          textAnchor="middle"
          fill={TEXT_MUTED}
          style={{
            font: '500 11px ui-monospace, monospace',
            letterSpacing: "0.2em",
          }}
        >
          THE GOAL
        </text>
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          fill={LENS_CORE_NAVY}
          style={{ font: '600 21px system-ui, "Segoe UI", sans-serif' }}
        >
          Your Ideal
        </text>
        <text
          x={cx}
          y={cy + 26}
          textAnchor="middle"
          fill={LENS_CORE_NAVY}
          style={{ font: '600 21px system-ui, "Segoe UI", sans-serif' }}
        >
          Business
        </text>
      </g>
    </svg>
  );
}

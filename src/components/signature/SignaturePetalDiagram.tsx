"use client";

import type { SignatureModuleId, SignatureScore } from "@/lib/signatureModelV2";
import {
  SIGNATURE_LIFESTYLE_LENSES,
  SIGNATURE_MODEL_V2,
} from "@/lib/signatureModelV2";

/** Classic v2 geometry: three pillars */
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

/** Income / Impact / Freedom overlaps — deepest brand navy (darker than Connect) */
const LENS_CORE_NAVY = "#1f3a66";
const LENS_STROKE = "rgba(22, 45, 80, 0.65)";

/** Pillar discs: Connect (BOSS brand blue, lighter than LENS_CORE_NAVY), Enrol (light blue), Deliver (teal) */
const PILLAR_COLORS = ["#0c5290", "#6eb6f0", "#2a9d8f"];

const TEXT_ON_FILL = "#ffffff";
const TEXT_ON_PETAL = "#1f3a66";
const TEXT_MUTED = "rgba(31, 58, 102, 0.55)";
/** Labels sitting on dark lens fills */
const TEXT_ON_LENS = "#f8fafc";
const TEXT_ON_LENS_MUTED = "rgba(248, 250, 252, 0.82)";

const STATUS_FILL: Record<"red" | "yellow" | "green", string> = {
  red: "#e06b6b",
  yellow: "#e6c25a",
  green: "#6bb37a",
};

type PillarGeom = {
  id: string;
  title: string;
  green: string;
  red: string;
  angle: number;
  color: string;
  pos: { x: number; y: number };
};

function petalPath(
  pillar: PillarGeom,
  slotIndex: number,
  pillars: PillarGeom[]
) {
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

  return `M ${x1} ${y1} L ${x2} ${y2} A ${r2} ${r2} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${r1} ${r1} 0 0 0 ${x1} ${y1} Z`;
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
  return `M ${p1.x} ${p1.y} A ${rC} ${rC} 0 0 0 ${p2.x} ${p2.y} A ${rC} ${rC} 0 0 0 ${p1.x} ${p1.y} Z`;
}

function scoreForPetal(
  scores: Partial<Record<SignatureModuleId, SignatureScore>>,
  pillarId: string,
  slotIndex: number
): SignatureScore {
  const pillar = SIGNATURE_MODEL_V2.pillars.find((p) => p.id === pillarId);
  const mod = pillar?.modules[slotIndex];
  if (!mod) return null;
  const v = scores[mod.id];
  return v === "red" || v === "yellow" || v === "green" ? v : null;
}

function nextScore(current: SignatureScore): SignatureScore {
  const order: SignatureScore[] = [null, "red", "yellow", "green"];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

function lensScore(
  scores: Partial<Record<SignatureModuleId, SignatureScore>>,
  lensIndex: number
): SignatureScore {
  const id = SIGNATURE_LIFESTYLE_LENSES[lensIndex]!.moduleId;
  const v = scores[id];
  return v === "red" || v === "yellow" || v === "green" ? v : null;
}

export function SignaturePetalDiagram({
  scores,
  onScoreChange,
}: {
  scores: Partial<Record<SignatureModuleId, SignatureScore>>;
  onScoreChange: (moduleId: SignatureModuleId, score: SignatureScore) => void;
}) {
  const data = SIGNATURE_MODEL_V2;
  const pillars: PillarGeom[] = data.pillars.map((p, i) => {
    const a = ANGLES[i];
    const rad = (a * Math.PI) / 180;
    return {
      id: p.id,
      title: p.title,
      green: p.green,
      red: p.red,
      angle: a,
      color: PILLAR_COLORS[i] ?? PILLAR_COLORS[0],
      pos: { x: cx + oC * Math.cos(rad), y: cy + oC * Math.sin(rad) },
    };
  });

  const lensPairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 2],
  ];

  const pairLabels = [
    { label: "Income", lensIdx: 0 },
    { label: "Impact", lensIdx: 1 },
    { label: "Freedom", lensIdx: 2 },
  ];

  /** Tight crop: geometry sits ~inset 75–925; removes large empty margins that read as “gap” above/beside the flower */
  const vb = "75 75 850 850";

  return (
    <svg
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      className="h-auto w-full max-w-[min(100%,38rem)] sm:max-w-[min(100%,46rem)] lg:max-w-[52rem]"
      role="img"
      aria-label="Signature Model: nine modules and three lifestyle lenses"
    >
      {pillars.flatMap((p, pi) =>
        [0, 1, 2].map((mi) => {
          const pillarDef = data.pillars[pi];
          const moduleId = pillarDef.modules[mi].id;
          const status = scoreForPetal(scores, p.id, mi);
          const statusFill = status ? STATUS_FILL[status] : null;
          const baseFill = "#ffffff";
          return (
            <path
              key={`petal-${p.id}-${mi}`}
              d={petalPath(p, mi, pillars)}
              fill={statusFill ?? baseFill}
              stroke="rgba(31,58,102,0.14)"
              strokeWidth={0.9}
              onClick={() =>
                onScoreChange(moduleId, nextScore(status ?? null))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onScoreChange(moduleId, nextScore(status ?? null));
                }
              }}
              tabIndex={0}
              className="cursor-pointer outline-none transition-[fill] duration-200 focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          );
        })
      )}

      {pillars.map((p) => (
        <circle
          key={p.id}
          cx={p.pos.x}
          cy={p.pos.y}
          r={rC}
          fill={p.color}
          stroke="#ffffff"
          strokeWidth={2}
          style={{ pointerEvents: "none" }}
        />
      ))}

      {lensPairs.map(([i, j], k) => {
        const st = lensScore(scores, k);
        const tint = st ? STATUS_FILL[st] : null;
        const fill = tint ?? LENS_CORE_NAVY;
        const fillOpacity = tint ? 0.72 : 1;
        return (
          <path
            key={`lens-${k}`}
            d={lensPath(i, j, pillars)}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={LENS_STROKE}
            strokeWidth={1}
            style={{ pointerEvents: "none" }}
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
        const path = `M ${P1.x} ${P1.y} A ${rC} ${rC} 0 0 1 ${P2.x} ${P2.y} A ${rC} ${rC} 0 0 1 ${P3.x} ${P3.y} A ${rC} ${rC} 0 0 1 ${P1.x} ${P1.y} Z`;
        return (
          <path
            d={path}
            fill="#ffffff"
            stroke="rgba(31,58,102,0.12)"
            strokeWidth={1}
            style={{ pointerEvents: "none" }}
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
            style={{ pointerEvents: "none" }}
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
          style={{ pointerEvents: "none" }}
        />
      ))}

      {pairLabels.map((o) => {
        const [i, j] = lensPairs[o.lensIdx]!;
        const A = pillars[i].pos;
        const B = pillars[j].pos;
        const mx = (A.x + B.x) / 2;
        const my = (A.y + B.y) / 2;
        const toCentreX = cx - mx;
        const toCentreY = cy - my;
        const tcLen = Math.sqrt(toCentreX * toCentreX + toCentreY * toCentreY) || 1;
        const ux = -toCentreX / tcLen;
        const uy = -toCentreY / tcLen;
        const offset = 58;
        const x = mx + ux * offset;
        const y = my + uy * offset;
        const code = SIGNATURE_LIFESTYLE_LENSES[o.lensIdx]?.code ?? "";
        return (
          <g key={o.label} style={{ pointerEvents: "none" }}>
            <text
              x={x}
              y={y + 4}
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
              {o.label}
            </text>
            <text
              x={x}
              y={y + 22}
              textAnchor="middle"
              fill={TEXT_ON_LENS_MUTED}
              style={{
                font: '600 11px ui-monospace, monospace',
                letterSpacing: "0.12em",
                paintOrder: "stroke fill",
                stroke: "rgba(15, 23, 42, 0.3)",
                strokeWidth: 2,
                strokeLinejoin: "round",
              }}
            >
              {code}
            </text>
          </g>
        );
      })}

      {pillars.flatMap((p, pi) =>
        [0, 1, 2].map((mi) => {
          const num = String(pi * 3 + mi + 1).padStart(2, "0");
          const m = data.pillars[pi]?.modules[mi];
          if (!m) return null;
          const cleaned = m.diagramTitle.replace(/^The /, "");
          const words = cleaned.split(/\s+/);
          let line1: string;
          let line2: string;
          if (words.length <= 1) {
            line1 = cleaned;
            line2 = "";
          } else if (words.length === 2) {
            line1 = words[0];
            line2 = words[1];
          } else {
            const mid = Math.ceil(words.length / 2);
            line1 = words.slice(0, mid).join(" ");
            line2 = words.slice(mid).join(" ");
          }
          const aCenter = p.angle + SLOT_OFFSETS[mi];
          const span = PETAL_SPAN - 6;
          const a1 = aCenter - span / 2;
          const a2 = aCenter + span / 2;
          const a1r = (a1 * Math.PI) / 180;
          const a2r = (a2 * Math.PI) / 180;
          const isLower = Math.sin((aCenter * Math.PI) / 180) > 0;
          const rOuter = (PETAL_INNER + PETAL_OUTER) / 2 + 11 - 4;
          const rInner = (PETAL_INNER + PETAL_OUTER) / 2 - 11 - 4;
          const rLine1 = isLower ? rInner : rOuter;
          const rLine2 = isLower ? rOuter : rInner;
          function arc(rr: number) {
            const x1 = p.pos.x + rr * Math.cos(a1r);
            const y1 = p.pos.y + rr * Math.sin(a1r);
            const x2 = p.pos.x + rr * Math.cos(a2r);
            const y2 = p.pos.y + rr * Math.sin(a2r);
            return isLower
              ? `M ${x2} ${y2} A ${rr} ${rr} 0 0 0 ${x1} ${y1}`
              : `M ${x1} ${y1} A ${rr} ${rr} 0 0 1 ${x2} ${y2}`;
          }
          const rNum = isLower ? PETAL_INNER + 12 : PETAL_OUTER - 12;
          function numArc() {
            const x1 = p.pos.x + rNum * Math.cos(a1r);
            const y1 = p.pos.y + rNum * Math.sin(a1r);
            const x2 = p.pos.x + rNum * Math.cos(a2r);
            const y2 = p.pos.y + rNum * Math.sin(a2r);
            return isLower
              ? `M ${x2} ${y2} A ${rNum} ${rNum} 0 0 0 ${x1} ${y1}`
              : `M ${x1} ${y1} A ${rNum} ${rNum} 0 0 1 ${x2} ${y2}`;
          }
          const fill = TEXT_ON_PETAL;
          const fontStyle = {
            font: '500 15px system-ui, "Segoe UI", sans-serif',
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
              <g key={`petal-text-${p.id}-${mi}`} style={{ pointerEvents: "none" }}>
                <path id={`pt-mid-${p.id}-${mi}`} d={arc(rMid)} fill="none" />
                <text fill={fill} style={fontStyle}>
                  <textPath
                    href={`#pt-mid-${p.id}-${mi}`}
                    startOffset="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {line1}
                  </textPath>
                </text>
                <path id={`pt-num-${p.id}-${mi}`} d={numArc()} fill="none" />
                <text fill={TEXT_ON_PETAL} style={numStyle}>
                  <textPath
                    href={`#pt-num-${p.id}-${mi}`}
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
            <g key={`petal-text-${p.id}-${mi}`} style={{ pointerEvents: "none" }}>
              <path id={`pt-l1-${p.id}-${mi}`} d={arc(rLine1)} fill="none" />
              <path id={`pt-l2-${p.id}-${mi}`} d={arc(rLine2)} fill="none" />
              <text fill={fill} style={fontStyle}>
                <textPath
                  href={`#pt-l1-${p.id}-${mi}`}
                  startOffset="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {line1}
                </textPath>
              </text>
              <text fill={fill} style={fontStyle}>
                <textPath
                  href={`#pt-l2-${p.id}-${mi}`}
                  startOffset="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {line2}
                </textPath>
              </text>
              <path id={`pt-num-${p.id}-${mi}`} d={numArc()} fill="none" />
              <text fill={TEXT_ON_PETAL} style={numStyle}>
                <textPath
                  href={`#pt-num-${p.id}-${mi}`}
                  startOffset="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {num}
                </textPath>
              </text>
            </g>
          );
        })
      )}

      {pillars.map((p) => {
        const dx = p.pos.x - cx;
        const dy = p.pos.y - cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;
        const tx = p.pos.x + ux * (rC * 0.4);
        const ty = p.pos.y + uy * (rC * 0.4);
        return (
          <g key={`${p.id}-c`} style={{ pointerEvents: "none" }}>
            <text
              x={tx}
              y={ty - 8}
              textAnchor="middle"
              fill={TEXT_ON_FILL}
              style={{
                font: '600 24px system-ui, "Segoe UI", sans-serif',
                letterSpacing: "0.14em",
              }}
            >
              {p.title.toUpperCase()}
            </text>
            <text
              x={tx}
              y={ty + 22}
              textAnchor="middle"
              fill={TEXT_ON_FILL}
              style={{
                font: '400 16px system-ui, "Segoe UI", sans-serif',
                fontStyle: "italic",
              }}
            >
              <tspan x={tx} dy="0">
                {p.green.toLowerCase()}
              </tspan>
              <tspan
                x={tx}
                dy="22"
                style={{ opacity: 0.82, fontStyle: "normal", fontSize: 13 }}
              >
                not {p.red.toLowerCase()}
              </tspan>
            </text>
          </g>
        );
      })}

      <g style={{ pointerEvents: "none" }}>
        <text
          x={cx}
          y={cy - 22}
          textAnchor="middle"
          fill={TEXT_MUTED}
          style={{
            font: '500 9px ui-monospace, monospace',
            letterSpacing: "0.28em",
          }}
        >
          THE GOAL
        </text>
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill="#1f3a66"
          style={{ font: '600 21px system-ui, "Segoe UI", sans-serif' }}
        >
          Effortless
        </text>
        <text
          x={cx}
          y={cy + 30}
          textAnchor="middle"
          fill="#1f3a66"
          style={{ font: '600 21px system-ui, "Segoe UI", sans-serif' }}
        >
          Impact
        </text>
      </g>
    </svg>
  );
}

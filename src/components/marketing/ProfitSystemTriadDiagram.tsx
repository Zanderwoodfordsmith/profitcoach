"use client";

import { useState } from "react";
import { AREAS } from "@/lib/bossData";

const navy = "#0c5290";
const lightBlue = "#42a1ee";
const teal = "#1ca0c2";

type PillarKey = "vision" | "velocity" | "value";

const PILLAR_META: Record<
  PillarKey,
  { label: string; tagline: string; fill: string; cx: number; cy: number; r: number }
> = {
  vision: {
    label: "Vision",
    tagline: "Clarify the future",
    fill: navy,
    cx: 200,
    cy: 118,
    r: 40,
  },
  velocity: {
    label: "Velocity",
    tagline: "Profit & growth",
    fill: lightBlue,
    cx: 278,
    cy: 268,
    r: 40,
  },
  value: {
    label: "Value",
    tagline: "Lasting value",
    fill: teal,
    cx: 122,
    cy: 268,
    r: 40,
  },
};

/** Nine business modules (excludes Owner Performance / foundation). Order follows the Profit System journey: Vision → Velocity → Value. */
const NINE_MODULES: {
  areaIndex: number;
  pillar: PillarKey;
  blurb: string;
}[] = [
  {
    areaIndex: 1,
    pillar: "vision",
    blurb: "Direction, alignment, and narrative the whole business can follow.",
  },
  {
    areaIndex: 2,
    pillar: "vision",
    blurb: "A clear strategy your team can execute — not a slide deck in a drawer.",
  },
  {
    areaIndex: 3,
    pillar: "vision",
    blurb: "Rhythm and plans that turn strategy into what happens this quarter.",
  },
  {
    areaIndex: 4,
    pillar: "velocity",
    blurb: "Margin, cash, and the financial engine that funds growth.",
  },
  {
    areaIndex: 5,
    pillar: "velocity",
    blurb: "Predictable demand and a message that wins the right customers.",
  },
  {
    areaIndex: 6,
    pillar: "velocity",
    blurb: "Delivery that scales without you in every detail.",
  },
  {
    areaIndex: 7,
    pillar: "value",
    blurb: "Numbers you trust and KPIs that drive decisions.",
  },
  {
    areaIndex: 8,
    pillar: "value",
    blurb: "Systems and infrastructure that make quality repeatable.",
  },
  {
    areaIndex: 9,
    pillar: "value",
    blurb: "Leaders, culture, and accountability — the team runs the machine.",
  },
];

const CX = 200;
const CY = 200;
const ORBIT_R = 158;

function orbitPoint(i: number): { x: number; y: number } {
  const n = NINE_MODULES.length;
  const a = -Math.PI / 2 + (i / n) * 2 * Math.PI;
  return { x: CX + ORBIT_R * Math.cos(a), y: CY + ORBIT_R * Math.sin(a) };
}

export function ProfitSystemTriadDiagram() {
  const [active, setActive] = useState<number | null>(0);

  return (
    <div className="w-full">
      <div className="relative mx-auto max-w-[min(100%,440px)]">
        <svg
          viewBox="0 0 400 400"
          className="h-auto w-full drop-shadow-[0_20px_50px_-20px_rgba(12,82,144,0.35)]"
          role="img"
          aria-label="The Profit System: three pillars and nine business modules"
        >
          {/* faint orbit */}
          <circle
            cx={CX}
            cy={CY}
            r={ORBIT_R}
            fill="none"
            stroke="#0c5290"
            strokeOpacity={0.08}
            strokeWidth={1}
          />

          {/* links module → pillar hub */}
          {NINE_MODULES.map((m, i) => {
            const p = orbitPoint(i);
            const hub = PILLAR_META[m.pillar];
            return (
              <line
                key={`link-${m.areaIndex}`}
                x1={p.x}
                y1={p.y}
                x2={hub.cx}
                y2={hub.cy}
                stroke={hub.fill}
                strokeOpacity={active === i ? 0.35 : 0.12}
                strokeWidth={active === i ? 2 : 1}
                className="transition-all duration-300"
              />
            );
          })}

          {/* hub triangle hint */}
          <path
            d={`M ${PILLAR_META.vision.cx} ${PILLAR_META.vision.cy + PILLAR_META.vision.r * 0.35} L ${PILLAR_META.value.cx - PILLAR_META.value.r * 0.35} ${PILLAR_META.value.cy - PILLAR_META.value.r * 0.2} L ${PILLAR_META.velocity.cx + PILLAR_META.velocity.r * 0.35} ${PILLAR_META.velocity.cy - PILLAR_META.velocity.r * 0.2} Z`}
            fill="#0c5290"
            fillOpacity={0.04}
          />

          {/* three pillar hubs */}
          {(Object.keys(PILLAR_META) as PillarKey[]).map((key) => {
            const h = PILLAR_META[key];
            return (
              <g key={key}>
                <circle
                  cx={h.cx}
                  cy={h.cy}
                  r={h.r + 5}
                  fill="#ffffff"
                  fillOpacity={0.92}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <circle
                  cx={h.cx}
                  cy={h.cy}
                  r={h.r}
                  fill={h.fill}
                  fillOpacity={0.92}
                  className="transition-transform duration-300"
                />
                <text
                  x={h.cx}
                  y={h.cy - 6}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight={700}
                  letterSpacing="0.14em"
                  style={{ textTransform: "uppercase" }}
                >
                  {h.label}
                </text>
                <text
                  x={h.cx}
                  y={h.cy + 10}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.88)"
                  fontSize="8"
                  fontWeight={500}
                >
                  {h.tagline}
                </text>
              </g>
            );
          })}

          {/* outer modules */}
          {NINE_MODULES.map((m, i) => {
            const p = orbitPoint(i);
            const hub = PILLAR_META[m.pillar];
            const isOn = active === i;
            const name = AREAS[m.areaIndex]?.name ?? `Area ${m.areaIndex}`;
            return (
              <g
                key={m.areaIndex}
                role="button"
                tabIndex={0}
                aria-pressed={isOn}
                aria-label={`${name}. ${m.blurb}`}
                className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActive(i);
                  }
                }}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isOn ? 22 : 18}
                  fill="#ffffff"
                  stroke={hub.fill}
                  strokeWidth={isOn ? 2.5 : 1.2}
                  strokeOpacity={isOn ? 1 : 0.55}
                  className="transition-all duration-300 hover:stroke-opacity-100"
                />
                <text
                  x={p.x}
                  y={p.y + 4}
                  textAnchor="middle"
                  fill={isOn ? hub.fill : "#475569"}
                  fontSize="10"
                  fontWeight={700}
                  className="pointer-events-none"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* detail panel */}
      <div className="mx-auto mt-8 max-w-lg rounded-3xl border border-slate-200/60 bg-white/70 px-6 py-5 backdrop-blur-xl">
        {active != null && NINE_MODULES[active] ? (
          <>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-500">
              {PILLAR_META[NINE_MODULES[active].pillar].label} · module{" "}
              {active + 1} of 9
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              {AREAS[NINE_MODULES[active].areaIndex]?.name}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {NINE_MODULES[active].blurb}
            </p>
          </>
        ) : null}
        <p className="mt-4 text-xs text-slate-400">
          Owner Performance (foundation) sits at the centre of the full BOSS model —
          your readiness as the owner — and is scored in the diagnostic alongside these
          nine areas.
        </p>
      </div>
    </div>
  );
}

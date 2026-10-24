"use client";

import { useEffect, useState } from "react";

/** The ten BOSS areas, in wheel order, coloured by pillar (same as the site wheel). */
const AREAS = [
  { name: "Owner Performance", color: "#4C667A" },
  { name: "Aligned Vision", color: "#0C5290" },
  { name: "Defined Strategy", color: "#0C5290" },
  { name: "Disciplined Planning", color: "#0C5290" },
  { name: "Profit & Cash Flow", color: "#2E8AD8" },
  { name: "Revenue & Marketing", color: "#2E8AD8" },
  { name: "Operations & Delivery", color: "#2E8AD8" },
  { name: "Financials & Metrics", color: "#157A96" },
  { name: "Infrastructure & Systems", color: "#157A96" },
  { name: "Team & Leadership", color: "#157A96" },
];

const C = 200;
const R_IN = 92;
const R_OUT = 188;
const GAP = 0.035; // radians between wedges
const SCAN_MS = 1700;

function wedge(i: number): string {
  const step = (Math.PI * 2) / AREAS.length;
  const a0 = -Math.PI / 2 + i * step + GAP / 2;
  const a1 = a0 + step - GAP;
  const p = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
  return [
    `M ${p(R_IN, a0)}`,
    `L ${p(R_OUT, a0)}`,
    `A ${R_OUT} ${R_OUT} 0 0 1 ${p(R_OUT, a1)}`,
    `L ${p(R_IN, a1)}`,
    `A ${R_IN} ${R_IN} 0 0 0 ${p(R_IN, a0)}`,
    "Z",
  ].join(" ");
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * A BOSS Wheel with nothing in it. The wheel scans once, looking for the page.
 * With `countdown`, the centre runs from 404 to a score of 0. `compact` drops
 * the label under the number, for small wheels.
 */
export function EmptyBossWheel({
  countdown = false,
  compact = false,
  className = "",
}: {
  countdown?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(404);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!countdown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(0);
      setDone(true);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const delay = 350;
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min(Math.max((now - start - delay) / SCAN_MS, 0), 1);
      setValue(Math.round(404 * (1 - easeOut(t))));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [countdown]);

  return (
    <div className={`nf-wheel relative aspect-square ${className}`}>
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {AREAS.map((area, i) => (
          <path
            key={area.name}
            d={wedge(i)}
            fill={area.color}
            stroke={area.color}
            strokeWidth={1}
            strokeOpacity={0.22}
            className="nf-wedge"
            style={{ animationDelay: `${350 + i * (SCAN_MS / AREAS.length) * 0.85}ms` }}
          />
        ))}
      </svg>
      <div aria-hidden className="absolute inset-[22%] grid place-items-center rounded-full bg-white shadow-[0_2px_6px_rgb(19_45_73/0.06),0_18px_40px_-14px_rgb(19_45_73/0.28)]">
        <div className="text-center">
          <p className="text-[clamp(1.25rem,21cqi,5.5rem)] font-bold leading-none tracking-[-0.04em] text-[#0D1F31] tabular-nums">
            {value}
          </p>
          {compact ? null : (
            <p className="mt-[0.35em] text-[clamp(0.72rem,5.2cqi,1.05rem)] font-semibold text-[#46566B]">
              {countdown && done ? "out of 100" : "Page not found"}
            </p>
          )}
        </div>
      </div>
      <span className="sr-only">
        {countdown ? "This page scores 0 out of 100." : "Page not found."}
      </span>
    </div>
  );
}

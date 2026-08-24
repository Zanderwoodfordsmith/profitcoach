"use client";

import { useEffect, useState } from "react";
import { Flag, Trophy } from "lucide-react";

import {
  ACCELERATORS,
  PILLARS,
  type PillarKey,
} from "./profitSystemData";

/**
 * The nine-step roadmap (replaces nine-step-roadmap.png).
 * BCA-roadmap card language: left pillar rail, 3×3 grid of cards with number
 * badges and a transformation strip. Numbers read top-left → bottom-right.
 */

const ROWS: PillarKey[] = ["vision", "velocity", "value"];

export function NineStepRoadmap({
  animate = true,
  className,
}: {
  animate?: boolean;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const t = window.setTimeout(() => setRevealed(true), 60);
    return () => window.clearTimeout(t);
  }, [animate]);

  return (
    <div className={className ?? "w-full"}>
      <div className="relative">
        {/* Start chip */}
        <div className="mb-3 flex justify-start">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white">
            <Flag className="h-3.5 w-3.5" /> Today&apos;s business
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {ROWS.map((pillarKey, rowIndex) => {
            const pillar = PILLARS[pillarKey];
            const steps = ACCELERATORS.filter((a) => a.pillar === pillarKey);
            return (
              <div
                key={pillarKey}
                className="grid gap-3 md:grid-cols-[7.5rem_repeat(3,1fr)]"
              >
                {/* Pillar rail */}
                <div
                  className="flex items-center justify-center rounded-xl px-3 py-3 transition-all duration-500 md:py-0"
                  style={{
                    background: `linear-gradient(160deg, ${pillar.color} 0%, ${pillar.colorDark} 100%)`,
                    opacity: revealed ? 1 : 0,
                    transform: revealed ? "none" : "translateX(-12px)",
                    transitionDelay: `${rowIndex * 220}ms`,
                  }}
                >
                  <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-white md:[writing-mode:vertical-rl] md:rotate-180">
                    {pillar.label}
                  </p>
                </div>

                {steps.map((step, colIndex) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.step}
                      className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_-18px_rgba(12,82,144,0.45)] transition-all duration-500"
                      style={{
                        opacity: revealed ? 1 : 0,
                        transform: revealed ? "none" : "translateY(14px)",
                        transitionDelay: `${rowIndex * 220 + (colIndex + 1) * 110}ms`,
                      }}
                    >
                      <span
                        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-sm font-extrabold text-white"
                        style={{ backgroundColor: pillar.color }}
                      >
                        {step.step}
                      </span>
                      <div className="px-4 pb-3 pt-4">
                        <Icon
                          className="h-5 w-5"
                          style={{ color: pillar.color }}
                        />
                        <p
                          className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em]"
                          style={{ color: pillar.color }}
                        >
                          {pillar.label}
                        </p>
                        <p className="mt-0.5 pr-6 text-[15px] font-bold leading-snug text-slate-900">
                          {step.name}
                        </p>
                      </div>
                      <div
                        className="px-4 py-2 text-[11px] font-semibold text-white/95"
                        style={{ backgroundColor: pillar.colorDark }}
                      >
                        {step.from} <span className="opacity-70">→</span>{" "}
                        {step.to}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* End chip */}
        <div className="mt-3 flex justify-end">
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-opacity duration-500"
            style={{
              backgroundColor: "#1ca0c2",
              opacity: revealed ? 1 : 0,
              transitionDelay: "1200ms",
            }}
          >
            <Trophy className="h-3.5 w-3.5" /> Ideal business
          </span>
        </div>
      </div>
    </div>
  );
}

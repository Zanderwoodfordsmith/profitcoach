"use client";

import { useEffect, useState } from "react";
import {
  Flame,
  BatteryLow,
  ListChecks,
  Telescope,
  Crown,
} from "lucide-react";

import { OWNER_LEVELS } from "./profitSystemData";

/**
 * The five Owner levels (replaces five-levels.png): Overwhelm → Owner.
 * Rows on the left, ascending staircase on the right; bars grow on mount.
 */

const LEVEL_ICONS = [Flame, BatteryLow, ListChecks, Telescope, Crown];

/** Blues ascending from light to deep — matches the house palette. */
const LEVEL_COLORS = ["#7cc0f4", "#42a1ee", "#1f7fd1", "#0c5290", "#1ca0c2"];

export function OwnerLevelsDiagram({
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

  const desc = [...OWNER_LEVELS].sort((a, b) => b.id - a.id);

  return (
    <div className={className ?? "w-full"}>
      <div className="grid items-center gap-8 md:grid-cols-[1.25fr_1fr]">
        {/* Level rows, 5 at the top */}
        <div className="divide-y divide-slate-200">
          {desc.map((level) => (
            <div key={level.id} className="flex items-start gap-4 py-3.5">
              <span
                className="w-8 shrink-0 text-3xl font-extrabold leading-none"
                style={{ color: LEVEL_COLORS[level.id - 1] }}
              >
                {level.id}
              </span>
              <div>
                <p
                  className="text-sm font-bold uppercase tracking-[0.14em]"
                  style={{ color: LEVEL_COLORS[level.id - 1] }}
                >
                  {level.name}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {level.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Staircase */}
        <div className="flex h-64 items-end justify-center gap-2.5 sm:h-72">
          {OWNER_LEVELS.map((level, i) => {
            const Icon = LEVEL_ICONS[i];
            const height = 26 + i * 18.5;
            return (
              <div
                key={level.id}
                className="flex w-[16%] max-w-16 flex-col items-center justify-end gap-2"
              >
                <Icon
                  className="h-5 w-5 transition-opacity duration-500"
                  style={{
                    color: LEVEL_COLORS[i],
                    opacity: revealed ? 1 : 0,
                    transitionDelay: `${450 + i * 110}ms`,
                  }}
                />
                <div
                  className="w-full rounded-t-lg transition-[height] duration-700 ease-out"
                  style={{
                    background: `linear-gradient(180deg, ${LEVEL_COLORS[i]} 0%, ${LEVEL_COLORS[i]}cc 100%)`,
                    height: revealed ? `${height}%` : "4%",
                    transitionDelay: `${i * 110}ms`,
                  }}
                />
                <span className="text-[10px] font-bold text-slate-400">
                  {level.id}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

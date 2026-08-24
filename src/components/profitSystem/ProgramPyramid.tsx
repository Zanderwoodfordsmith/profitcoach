"use client";

import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";

import {
  ACCELERATORS,
  OWNER_LEVELS,
  PILLARS,
  type DiagramIcon,
} from "./profitSystemData";

/**
 * The programme pyramid (replaces owner-pyramid.png), per the Figma brief:
 * a 4-3-2-1 pyramid of the nine accelerators plus a tenth "Going Pro"
 * section at the base. Owner levels rail on the left, stage purpose on the
 * right. Simplifies to stacked rows on small screens.
 */

type PyramidCell = {
  key: string;
  label: string;
  color: string;
  icon?: DiagramIcon;
};

const STAGES: { label: string; cells: PyramidCell[] }[] = (() => {
  const byStep = (n: number) => {
    const a = ACCELERATORS.find((x) => x.step === n)!;
    return {
      key: `a${n}`,
      label: a.name,
      color: PILLARS[a.pillar].color,
      icon: a.icon,
    };
  };
  return [
    // Bottom → top
    {
      label: "Focus",
      cells: [
        {
          key: "going-pro",
          label: "Going Pro",
          color: "#334155",
          icon: GraduationCap,
        },
        byStep(1),
        byStep(2),
        byStep(3),
      ],
    },
    {
      label: "Financial security",
      cells: [byStep(4), byStep(5), byStep(6)],
    },
    {
      label: "Future proof",
      cells: [byStep(7), byStep(8)],
    },
    {
      label: "Freedom",
      cells: [byStep(9)],
    },
  ];
})();

export function ProgramPyramid({
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

  // Render top row first (visual top of pyramid).
  const rows = [...STAGES].reverse();
  const levelsDesc = [...OWNER_LEVELS].sort((a, b) => b.id - a.id);

  return (
    <div className={className ?? "w-full"}>
      <div
        className="rounded-3xl px-4 py-8 sm:px-8"
        style={{
          background: "linear-gradient(165deg, #0b3560 0%, #082944 100%)",
        }}
      >
        <div className="grid gap-6 lg:grid-cols-[15rem_1fr_11rem]">
          {/* Owner levels rail */}
          <div className="hidden flex-col justify-between gap-3 lg:flex">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200/80">
              Business owner level
            </p>
            {levelsDesc.map((level) => (
              <div key={level.id}>
                <p className="text-sm font-bold text-white">
                  {level.id} · {level.name}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-sky-100/60">
                  {level.description}
                </p>
              </div>
            ))}
          </div>

          {/* Pyramid */}
          <div className="flex flex-col items-center justify-end gap-1.5">
            {rows.map((stage, rowIdx) => {
              const rowFromBottom = rows.length - 1 - rowIdx;
              return (
                <div
                  key={stage.label}
                  className="flex w-full justify-center gap-1.5 transition-all duration-600"
                  style={{
                    opacity: revealed ? 1 : 0,
                    transform: revealed ? "none" : "translateY(10px)",
                    transitionDelay: `${rowFromBottom * 170}ms`,
                  }}
                >
                  {stage.cells.map((cell) => {
                    const Icon = cell.icon;
                    return (
                      <div
                        key={cell.key}
                        className="flex aspect-[1.15] w-[23%] max-w-[7.5rem] flex-col items-center justify-center gap-1 rounded-lg px-1.5 text-center"
                        style={{
                          background: `linear-gradient(165deg, ${cell.color} 0%, ${cell.color}d9 100%)`,
                          boxShadow: "0 10px 24px -14px rgba(2,20,40,0.8)",
                        }}
                      >
                        {Icon ? (
                          <Icon className="h-4 w-4 text-white/85" />
                        ) : null}
                        <p className="text-[clamp(0.5rem,1.4vw,0.7rem)] font-semibold leading-tight text-white">
                          {cell.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Stage purpose rail */}
          <div className="hidden flex-col justify-between gap-3 py-1 lg:flex">
            <p className="text-right text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200/80">
              Purpose of stage
            </p>
            {rows.map((stage) => (
              <p
                key={stage.label}
                className="text-right text-sm font-extrabold uppercase tracking-[0.16em] text-white/90"
              >
                {stage.label}
              </p>
            ))}
          </div>
        </div>

        {/* Mobile stage labels */}
        <div className="mt-4 flex flex-wrap justify-center gap-2 lg:hidden">
          {[...STAGES].map((s) => (
            <span
              key={s.label}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-100"
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

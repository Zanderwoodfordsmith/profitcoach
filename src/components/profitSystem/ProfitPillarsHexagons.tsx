"use client";

import { useEffect, useState } from "react";

import {
  acceleratorsForPillar,
  HEX_CLIP_PATH,
  PILLARS,
  type PillarKey,
} from "./profitSystemData";

/**
 * The Profit System hexagon cluster (Figma briefs #1 and #2).
 *
 * `showAccelerators={false}` renders just the three pillars; `true` extends
 * the same layout with the nine accelerator hexagons, so the two states can
 * be animated into each other (staggered reveal on mount).
 *
 * Positions are percentages of a square canvas.
 */

type HexPos = { x: number; y: number };

/** Big pillar hexagon centres. */
const PILLAR_POS: Record<PillarKey, HexPos> = {
  vision: { x: 50, y: 27 },
  value: { x: 30.5, y: 63 },
  velocity: { x: 69.5, y: 63 },
};

/** Small accelerator hexagon centres, three per pillar (outer corners). */
const ACCEL_POS: Record<PillarKey, HexPos[]> = {
  vision: [
    { x: 50, y: 7.5 },
    { x: 28.5, y: 36 },
    { x: 71.5, y: 36 },
  ],
  value: [
    { x: 11, y: 51.5 },
    { x: 11, y: 75 },
    { x: 30.5, y: 86.5 },
  ],
  velocity: [
    { x: 89, y: 51.5 },
    { x: 89, y: 75 },
    { x: 69.5, y: 86.5 },
  ],
};

const PILLAR_ORDER: PillarKey[] = ["vision", "velocity", "value"];

export function ProfitPillarsHexagons({
  showAccelerators = true,
  animate = true,
  className,
}: {
  showAccelerators?: boolean;
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
      <div className="relative mx-auto aspect-square w-full max-w-[560px]">
        {/* Pillar hexagons */}
        {PILLAR_ORDER.map((key, pi) => {
          const meta = PILLARS[key];
          const pos = PILLAR_POS[key];
          const Icon = meta.icon;
          return (
            <div
              key={key}
              className="absolute transition-all duration-700 ease-out"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: "40%",
                aspectRatio: "0.9",
                transform: `translate(-50%, -50%) scale(${revealed ? 1 : 0.6})`,
                opacity: revealed ? 1 : 0,
                transitionDelay: `${pi * 130}ms`,
              }}
            >
              <div
                className="flex h-full w-full flex-col items-center justify-center gap-1 px-[12%] text-center"
                style={{
                  clipPath: HEX_CLIP_PATH,
                  background: `linear-gradient(160deg, ${meta.color} 0%, ${meta.colorDark} 100%)`,
                }}
              >
                <Icon className="h-[14%] w-auto text-white/90" />
                <p className="text-[clamp(0.7rem,2.6vw,1.05rem)] font-bold uppercase tracking-[0.18em] text-white">
                  {meta.label}
                </p>
                <p className="text-[clamp(0.5rem,1.7vw,0.72rem)] font-medium leading-snug text-white/85">
                  {meta.tagline}
                </p>
              </div>
            </div>
          );
        })}

        {/* Accelerator hexagons */}
        {showAccelerators
          ? PILLAR_ORDER.map((key, pi) => {
              const meta = PILLARS[key];
              const accels = acceleratorsForPillar(key);
              return ACCEL_POS[key].map((pos, ai) => {
                const accel = accels[ai];
                if (!accel) return null;
                const Icon = accel.icon;
                return (
                  <div
                    key={`${key}-${accel.step}`}
                    className="absolute transition-all duration-500 ease-out"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      width: "16.5%",
                      aspectRatio: "0.9",
                      transform: `translate(-50%, -50%) scale(${revealed ? 1 : 0.4})`,
                      opacity: revealed ? 1 : 0,
                      transitionDelay: `${420 + pi * 140 + ai * 90}ms`,
                    }}
                  >
                    <div
                      className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-white px-[10%] text-center"
                      style={{
                        clipPath: HEX_CLIP_PATH,
                        boxShadow: "inset 0 0 0 2px rgba(226,232,240,0.9)",
                      }}
                    >
                      <Icon
                        className="h-[18%] w-auto"
                        style={{ color: meta.color }}
                      />
                      <p className="text-[clamp(0.42rem,1.35vw,0.6rem)] font-semibold leading-tight text-slate-700">
                        {accel.name}
                      </p>
                    </div>
                  </div>
                );
              });
            })
          : null}

        {/* Centre mark */}
        <div
          className="absolute transition-all duration-500 ease-out"
          style={{
            left: "50%",
            top: "51.5%",
            width: "12%",
            aspectRatio: "0.9",
            transform: `translate(-50%, -50%) scale(${revealed ? 1 : 0})`,
            opacity: revealed ? 1 : 0,
            transitionDelay: showAccelerators ? "1300ms" : "500ms",
          }}
        >
          <div
            className="flex h-full w-full items-center justify-center bg-white"
            style={{
              clipPath: HEX_CLIP_PATH,
              boxShadow: "inset 0 0 0 2px rgba(12,82,144,0.25)",
            }}
          >
            <p className="text-center text-[clamp(0.32rem,1vw,0.5rem)] font-extrabold uppercase leading-tight tracking-wider text-[#0c5290]">
              Profit
              <br />
              System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

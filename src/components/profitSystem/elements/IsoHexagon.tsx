"use client";

import type { ReactNode } from "react";

import {
  HEX_CLIP_PATH,
  HEX_TOP_FACET_CLIP_PATH,
  PS_TONES,
  type DiagramIcon,
  type PsTone,
} from "../profitSystemData";

/**
 * Profit System hexagon element. Two variants:
 *
 * - "cube": bevelled hexagon with a lighter top facet — the icon sits in the
 *   middle of the top face, the label in the middle of the two front sides.
 * - "flat": one full-colour hexagon — icon and label centred together.
 */
export function IsoHexagon({
  variant = "cube",
  tone = "blue",
  color,
  icon: Icon,
  label,
  children,
  className,
}: {
  variant?: "cube" | "flat";
  tone?: PsTone;
  /** Overrides the tone base color. */
  color?: string;
  icon?: DiagramIcon;
  label?: string;
  children?: ReactNode;
  className?: string;
}) {
  const base = color ?? PS_TONES[tone].base;
  return (
    <div
      className={`relative ${className ?? "w-32"}`}
      style={{ aspectRatio: "0.88" }}
    >
      <div
        className="absolute inset-0"
        style={{ clipPath: HEX_CLIP_PATH, backgroundColor: base }}
      />
      {variant === "cube" ? (
        <div
          className="absolute inset-0"
          style={{
            clipPath: HEX_TOP_FACET_CLIP_PATH,
            backgroundColor: "rgba(255,255,255,0.22)",
          }}
        />
      ) : null}

      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-[14%] text-center">
          {children}
        </div>
      ) : variant === "cube" ? (
        <>
          {/* Icon centred on the top face */}
          {Icon ? (
            <div className="absolute inset-x-0 top-0 flex h-1/2 items-center justify-center">
              <Icon className="h-[38%] w-auto text-white/95" />
            </div>
          ) : null}
          {/* Label centred across the two front sides */}
          {label ? (
            <div className="absolute inset-x-0 bottom-[8%] top-1/2 flex items-center justify-center px-[15%]">
              <p className="text-center text-[0.8rem] font-bold leading-tight text-white">
                {label}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[6%] px-[15%] text-center">
          {Icon ? <Icon className="h-[20%] w-auto text-white/95" /> : null}
          {label ? (
            <p className="text-[0.8rem] font-bold leading-tight text-white">
              {label}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

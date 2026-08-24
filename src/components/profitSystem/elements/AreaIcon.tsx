"use client";

import { ArrowDown, ArrowDownLeft, ArrowDownRight } from "lucide-react";

import type { DiagramIcon } from "../profitSystemData";

/**
 * Two-tone Profit System icon treatment (from the brand references):
 * dark outline glyph with a fan of blue accent arrows.
 *
 * `accent="out"`  — arrows spread away below the glyph (momentum out)
 * `accent="in"`   — arrows converge into the glyph (focus in)
 * `accent="none"` — glyph only
 */
export function AreaIcon({
  icon: Icon,
  accent = "none",
  accentColor = "#42a1ee",
  glyphClassName = "text-slate-800",
  className,
}: {
  icon: DiagramIcon;
  accent?: "out" | "in" | "none";
  accentColor?: string;
  glyphClassName?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-col items-center ${className ?? ""}`}
      aria-hidden
    >
      <Icon
        className={`${accent === "none" ? "h-full w-full" : "h-[62%] w-[62%]"} ${glyphClassName}`}
      />
      {accent !== "none" ? (
        <span
          className="mt-[4%] flex items-center gap-[6%]"
          style={{
            color: accentColor,
            transform: accent === "in" ? "rotate(180deg)" : undefined,
          }}
        >
          <ArrowDownLeft className="h-[22%] w-[22%] min-h-3 min-w-3" strokeWidth={2.6} />
          <ArrowDown className="h-[22%] w-[22%] min-h-3 min-w-3" strokeWidth={2.6} />
          <ArrowDownRight className="h-[22%] w-[22%] min-h-3 min-w-3" strokeWidth={2.6} />
        </span>
      ) : null}
    </span>
  );
}

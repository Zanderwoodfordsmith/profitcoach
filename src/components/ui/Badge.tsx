import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

/**
 * The app's badges (DESIGN.md): small pills in a soft tint that label a
 * thing's status or type. Count bubbles on icons are not badges.
 */
export type BadgeTone = "grey" | "blue" | "green" | "amber" | "red";

const TONES: Record<BadgeTone, string> = {
  grey: "bg-slate-100 text-slate-700",
  blue: "bg-sky-50 text-[#0c5290]",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-rose-50 text-rose-700",
};

export function badgeClass(tone: BadgeTone = "grey", extra = "") {
  return cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium whitespace-nowrap", TONES[tone], extra);
}

export function Badge({
  tone = "grey",
  className = "",
  children,
  ...rest
}: { tone?: BadgeTone; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={badgeClass(tone, className)} {...rest}>
      {children}
    </span>
  );
}

import type { HTMLAttributes, ReactNode } from "react";

/**
 * The app's cards (proposed, Admin → Brand → Design). Plain for most
 * things; Raised only for things you click or that pop up; Soft for a
 * quiet panel inside a page or another card.
 */
export type CardVariant = "plain" | "raised" | "soft";

const VARIANTS: Record<CardVariant, string> = {
  plain: "rounded-2xl border border-slate-200 bg-white",
  raised:
    "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.14)]",
  soft: "rounded-2xl bg-slate-50",
};

export function cardClass(variant: CardVariant = "plain", extra = "") {
  return `${VARIANTS[variant]} ${extra}`.trim();
}

export function Card({
  variant = "plain",
  className = "p-5",
  children,
  ...rest
}: { variant?: CardVariant; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cardClass(variant, className)} {...rest}>
      {children}
    </div>
  );
}

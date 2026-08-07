"use client";

import type { ReactNode } from "react";

/**
 * Shared chrome for each First Campaign step — eyebrow, title, and one
 * outer content well so LinkedIn → Ideal Client stay visually aligned.
 * Nested cards (section confirm, forms) live inside this shell.
 */
export function CampaignStepPanel({
  step,
  total = 5,
  title,
  description,
  children,
}: {
  step: number;
  total?: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.04)]">
      <header className="border-b border-slate-100 px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0c5290]">
          Step {step} of {total}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-500">
            {description}
          </p>
        ) : null}
      </header>
      <div className="px-5 py-5 sm:px-8 sm:py-6">{children}</div>
    </section>
  );
}

"use client";

import type { ReactNode } from "react";
import { PageHeaderDescriptionInfo } from "./PageHeaderDescriptionInfo";

export type PageHeaderDescriptionPlacement = "info" | "below";

export type StickyPageHeaderProps = {
  /** Omit when the page body supplies the main title (e.g. article hero). */
  title?: ReactNode;
  /**
   * Inline after the title (same row, left-aligned tab group with a gap from
   * the title). Prefer `PageHeaderUnderlineTabs` for underline tabs.
   */
  tabs?: ReactNode;
  description?: ReactNode;
  /**
   * Where to show `description`. `info` (default): compact (i) popover next to the title.
   * `below`: previous layout—visible under the title (subtitles, contact metadata, etc.).
   */
  descriptionPlacement?: PageHeaderDescriptionPlacement;
  /** Small label above title (e.g. “Profit Coach”) */
  eyebrow?: ReactNode;
  /** Block above eyebrow (e.g. back links) */
  leading?: ReactNode;
  /** Block below description (filters, controls) */
  below?: ReactNode;
  /** Right-aligned actions */
  actions?: ReactNode;
  className?: string;
  /**
   * Negative horizontal margin + padding so the bar spans the main column.
   * Set `false` to disable (e.g. nested layouts). Default matches coach/admin `main` horizontal padding.
   */
  bleedInset?: string | false;
};

export function StickyPageHeader({
  title,
  tabs,
  description,
  descriptionPlacement = "info",
  eyebrow,
  leading,
  below,
  actions,
  className,
  bleedInset = "-mx-[60px] px-[60px]",
}: StickyPageHeaderProps) {
  const shell = [
    "sticky top-0 z-10 border-b border-slate-200/90 bg-white pb-1 pt-4 shadow-sm",
    typeof bleedInset === "string" ? bleedInset : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shell}>
      <div
        className={`flex flex-wrap justify-between gap-3 ${tabs ? "items-end" : "items-start"}`}
      >
        <header className="min-w-0 flex-1 text-left">
          {leading ? <div className="mb-2">{leading}</div> : null}
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
              {eyebrow}
            </p>
          ) : null}
          <div
            className={
              eyebrow
                ? `mt-1 flex min-w-0 flex-wrap gap-x-6 gap-y-2 ${tabs ? "items-end" : "items-center"}`
                : `flex min-w-0 flex-wrap gap-x-6 gap-y-2 ${tabs ? "items-end" : "items-center"}`
            }
          >
            <div className="flex min-w-0 items-center gap-2">
              {title != null && title !== "" ? (
                <h1 className="py-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  {title}
                </h1>
              ) : null}
              {description && descriptionPlacement === "info" ? (
                <PageHeaderDescriptionInfo>
                  {description}
                </PageHeaderDescriptionInfo>
              ) : null}
            </div>
            {tabs ? (
              <div className="min-w-0 shrink-0 overflow-x-auto pb-px">
                {tabs}
              </div>
            ) : null}
          </div>
          {description && descriptionPlacement === "below" ? (
            <div className="mt-1 max-w-2xl text-base leading-snug text-slate-600 sm:mt-1.5">
              {description}
            </div>
          ) : null}
          {below ? <div className="mt-3">{below}</div> : null}
        </header>
        {actions ? (
          <div
            className={`flex shrink-0 flex-col items-stretch gap-2 sm:items-end ${tabs ? "" : "self-start"}`}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

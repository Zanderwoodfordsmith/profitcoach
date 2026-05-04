"use client";

import type { ReactNode } from "react";

export type DashboardPageSectionProps = {
  /** Always use {@link StickyPageHeader} here so the bar stays consistent app-wide. */
  header: ReactNode;
  children: ReactNode;
  /**
   * Vertical gap between the sticky header and the content column, and between
   * stacked blocks inside the content column.
   */
  gapClass?: string;
  /** Tailwind max-width for the content column (forms, cards). Header ignores this. */
  contentMaxWidthClass?: string;
  outerClassName?: string;
  contentClassName?: string;
};

/**
 * Standard dashboard page shell: full-width sticky header (via negative margin
 * inside {@link StickyPageHeader}), then a centered max-width column for body
 * content. Use on Account, Settings, and similar pages so headers stay aligned
 * with the rest of the app while forms stay readable width.
 */
export function DashboardPageSection({
  header,
  children,
  gapClass = "gap-4",
  contentMaxWidthClass = "max-w-4xl",
  outerClassName = "",
  contentClassName = "",
}: DashboardPageSectionProps) {
  const outer = `flex w-full min-w-0 flex-col ${gapClass} ${outerClassName}`.trim();
  const inner = `mx-auto flex w-full min-w-0 ${contentMaxWidthClass} flex-col ${gapClass} ${contentClassName}`.trim();
  return (
    <div className={outer}>
      {header}
      <div className={inner}>{children}</div>
    </div>
  );
}

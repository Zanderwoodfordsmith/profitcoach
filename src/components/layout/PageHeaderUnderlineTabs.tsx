"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/** Matches admin Coaches hub tabs (Coaches / Client success / Revenue). */
const tabBase =
  "-mb-px flex-none whitespace-nowrap border-b-[3px] pb-2 text-sm font-semibold leading-tight transition-colors sm:text-base";
const tabActive = "border-sky-600 text-sky-700";
const tabInactive =
  "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800";

const tabSubtleBase =
  "-mb-px min-w-max shrink-0 whitespace-nowrap border-b-[3px] pb-2 text-sm font-medium leading-tight transition-colors";
const tabSubtleActive = "border-slate-400 text-slate-600";
const tabSubtleInactive =
  "border-transparent text-slate-400 hover:border-slate-200 hover:text-slate-600";

export type PageHeaderUnderlineTabLinkItem = {
  kind: "link";
  href: string;
  label: ReactNode;
  active: boolean;
  /** Passed to Next.js Link; default false for in-page tab switches. */
  scroll?: boolean;
  onNavigate?: () => void;
  /** Lower-emphasis tab (e.g. admin-only preview). */
  variant?: "default" | "subtle";
};

export type PageHeaderUnderlineTabButtonItem = {
  kind: "button";
  id: string;
  label: ReactNode;
  active: boolean;
  onClick: () => void;
  variant?: "default" | "subtle";
};

export type PageHeaderUnderlineTabItem =
  | PageHeaderUnderlineTabLinkItem
  | PageHeaderUnderlineTabButtonItem;

export type PageHeaderUnderlineTabsProps = {
  items: PageHeaderUnderlineTabItem[];
  /** `aria-label` on the tab nav */
  ariaLabel?: string;
  className?: string;
  /**
   * `header` (default) sits in {@link StickyPageHeader} beside the title.
   * `content` is the first block in the page body (~10px extra top margin).
   */
  placement?: "header" | "content";
};

/**
 * Underline-style header tabs used with {@link StickyPageHeader}`s `tabs` slot,
 * or as the first block in page content when `placement="content"`.
 * Use `kind: "link"` for route-based tabs; `kind: "button"` for client-only panels.
 */
export function PageHeaderUnderlineTabs({
  items,
  ariaLabel = "Section tabs",
  className,
  placement = "header",
}: PageHeaderUnderlineTabsProps) {
  const navClass = [
    "flex max-w-full flex-wrap items-end justify-start gap-x-4 gap-y-1 sm:gap-x-5",
    placement === "content" ? "mt-2.5" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav className={navClass} aria-label={ariaLabel}>
      {items.map((item) => {
        const subtle = item.variant === "subtle";
        const cls = subtle
          ? `${tabSubtleBase} ${item.active ? tabSubtleActive : tabSubtleInactive}`
          : `${tabBase} ${item.active ? tabActive : tabInactive}`;
        if (item.kind === "link") {
          return (
            <Link
              key={`${item.href}::${typeof item.label === "string" ? item.label : "tab"}`}
              href={item.href}
              scroll={item.scroll ?? false}
              onClick={item.onNavigate}
              className={cls}
            >
              {item.label}
            </Link>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={cls}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

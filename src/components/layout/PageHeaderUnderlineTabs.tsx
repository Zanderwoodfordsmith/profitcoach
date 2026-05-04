"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/** Matches admin Coaches hub tabs (Coaches / Client success / Revenue). */
const tabBase =
  "-mb-px border-b-[3px] pb-2 text-base font-semibold leading-tight transition-colors";
const tabActive = "border-sky-600 text-sky-700";
const tabInactive =
  "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800";

const tabSubtleBase =
  "-mb-px border-b-[3px] pb-2 text-sm font-medium leading-tight transition-colors";
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
};

/**
 * Underline-style header tabs used with {@link StickyPageHeader}`s `tabs` slot.
 * Use `kind: "link"` for route-based tabs; `kind: "button"` for client-only panels.
 */
export function PageHeaderUnderlineTabs({
  items,
  ariaLabel = "Section tabs",
}: PageHeaderUnderlineTabsProps) {
  return (
    <nav
      className="flex flex-wrap items-end justify-start gap-x-6 gap-y-1"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const subtle = item.variant === "subtle";
        const cls = subtle
          ? `${tabSubtleBase} ${item.active ? tabSubtleActive : tabSubtleInactive}`
          : `${tabBase} ${item.active ? tabActive : tabInactive}`;
        if (item.kind === "link") {
          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={item.scroll ?? false}
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

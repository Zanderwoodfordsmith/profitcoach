"use client";

import Link from "next/link";

/** Matches admin Coaches hub tabs (Coaches / Client success / Revenue). */
const tabBase =
  "-mb-px border-b-[3px] pb-2 text-base font-semibold leading-tight transition-colors";
const tabActive = "border-sky-600 text-sky-700";
const tabInactive =
  "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800";

export type PageHeaderUnderlineTabLinkItem = {
  kind: "link";
  href: string;
  label: string;
  active: boolean;
  /** Passed to Next.js Link; default false for in-page tab switches. */
  scroll?: boolean;
};

export type PageHeaderUnderlineTabButtonItem = {
  kind: "button";
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
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
      className="flex flex-wrap items-end gap-x-6 gap-y-1"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const cls = `${tabBase} ${item.active ? tabActive : tabInactive}`;
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

"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, MoreHorizontal } from "lucide-react";
import {
  planOverflowNav,
  type OverflowNavPlan,
} from "@/lib/layout/overflowNav";

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

const TAB_GAP_PX = 16;

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

function tabClassName(item: PageHeaderUnderlineTabItem): string {
  const subtle = item.variant === "subtle";
  return subtle
    ? `${tabSubtleBase} ${item.active ? tabSubtleActive : tabSubtleInactive}`
    : `${tabBase} ${item.active ? tabActive : tabInactive}`;
}

function tabKey(item: PageHeaderUnderlineTabItem, index: number): string {
  if (item.kind === "link") {
    return `${item.href}::${typeof item.label === "string" ? item.label : index}`;
  }
  return item.id;
}

function OverflowMenu({
  items,
  open,
  onClose,
  menuId,
  labelledBy,
  buttonRef,
}: {
  items: PageHeaderUnderlineTabItem[];
  open: boolean;
  onClose: () => void;
  menuId: string;
  labelledBy: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 176;
      const left = Math.min(
        Math.max(8, rect.right - width),
        window.innerWidth - width - 8
      );
      setPosition({ top: rect.bottom + 4, left });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, buttonRef]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, buttonRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-labelledby={labelledBy}
      className="fixed z-[220] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {items.map((item, index) => {
        const itemClass = `flex w-full items-center px-3 py-2 text-left text-sm ${
          item.active
            ? "bg-sky-50 font-semibold text-sky-800"
            : "text-slate-700 hover:bg-slate-50"
        }`;
        if (item.kind === "link") {
          return (
            <Link
              key={tabKey(item, index)}
              role="menuitem"
              href={item.href}
              scroll={item.scroll ?? false}
              onClick={() => {
                item.onNavigate?.();
                onClose();
              }}
              className={itemClass}
            >
              {item.label}
            </Link>
          );
        }
        return (
          <button
            key={tabKey(item, index)}
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}

function TabItem({ item }: { item: PageHeaderUnderlineTabItem }) {
  const cls = tabClassName(item);
  if (item.kind === "link") {
    return (
      <Link
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
    <button type="button" onClick={item.onClick} className={cls}>
      {item.label}
    </button>
  );
}

/**
 * Underline-style header tabs used with {@link StickyPageHeader}`s `tabs` slot,
 * or as the first block in page content when `placement="content"`.
 * Use `kind: "link"` for route-based tabs; `kind: "button"` for client-only panels.
 * Never wraps: leftover tabs go in a ⋯ menu, then a hamburger when not even
 * one tab fits beside it.
 */
export function PageHeaderUnderlineTabs({
  items,
  ariaLabel = "Section tabs",
  className,
  placement = "header",
}: PageHeaderUnderlineTabsProps) {
  const navRef = useRef<HTMLElement>(null);
  const moreMeasureRef = useRef<HTMLSpanElement>(null);
  const itemMeasureRefs = useRef<Array<HTMLElement | null>>([]);
  const overflowButtonRef = useRef<HTMLButtonElement>(null);
  const overflowButtonId = useId();
  const menuId = useId();
  const itemSignature = items
    .map((item, index) =>
      item.kind === "link"
        ? `${item.href}:${item.active}:${item.variant ?? ""}:${index}`
        : `${item.id}:${item.active}:${item.variant ?? ""}:${index}`
    )
    .join("|");
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [plan, setPlan] = useState<OverflowNavPlan>(() => ({
    mode: "all",
    visibleIndices: items.map((_, i) => i),
    overflowIndices: [],
  }));
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    function update() {
      const current = itemsRef.current;
      itemMeasureRefs.current = itemMeasureRefs.current.slice(0, current.length);
      const available = nav.clientWidth;
      const itemWidths = current.map((_, i) =>
        Math.ceil(itemMeasureRefs.current[i]?.getBoundingClientRect().width ?? 0)
      );
      const moreWidth = Math.ceil(
        moreMeasureRef.current?.getBoundingClientRect().width ?? 36
      );
      const activeIndex = Math.max(
        0,
        current.findIndex((item) => item.active)
      );
      const next = planOverflowNav({
        itemWidths,
        availableWidth: available,
        moreWidth,
        gap: TAB_GAP_PX,
        activeIndex,
      });
      setPlan((prev) =>
        prev.mode === next.mode &&
        prev.visibleIndices.join() === next.visibleIndices.join() &&
        prev.overflowIndices.join() === next.overflowIndices.join()
          ? prev
          : next
      );
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [itemSignature]);

  useEffect(() => {
    setMenuOpen(false);
  }, [itemSignature, plan.mode]);

  const overflowItems = plan.overflowIndices
    .map((i) => items[i])
    .filter((item): item is PageHeaderUnderlineTabItem => Boolean(item));
  const overflowActive = overflowItems.some((item) => item.active);
  const showOverflow = plan.mode !== "all" && overflowItems.length > 0;

  const navClass = [
    "relative flex min-w-0 flex-1 flex-nowrap items-end justify-start gap-x-4 overflow-hidden",
    placement === "content" ? "mt-2.5 w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const overflowTriggerClass = overflowActive
    ? `${tabBase} ${tabActive}`
    : `${tabBase} ${tabInactive}`;

  return (
    <nav ref={navRef} className={navClass} aria-label={ariaLabel}>
      <div
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 -z-10"
      >
        <div className="flex w-max flex-nowrap items-end gap-x-4">
          {items.map((item, index) => (
            <span
              key={`measure-${tabKey(item, index)}`}
              ref={(node) => {
                itemMeasureRefs.current[index] = node;
              }}
              className={tabClassName(item)}
            >
              {item.label}
            </span>
          ))}
          <span ref={moreMeasureRef} className={tabBase}>
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </div>

      {plan.mode === "menu"
        ? null
        : plan.visibleIndices.map((index) => {
            const item = items[index];
            if (!item) return null;
            return <TabItem key={tabKey(item, index)} item={item} />;
          })}

      {showOverflow ? (
        <div className="relative shrink-0">
          <button
            ref={overflowButtonRef}
            id={overflowButtonId}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            aria-label={plan.mode === "menu" ? `${ariaLabel} menu` : "More tabs"}
            onClick={() => setMenuOpen((open) => !open)}
            className={overflowTriggerClass}
          >
            {plan.mode === "menu" ? (
              <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
            ) : (
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            )}
          </button>
          <OverflowMenu
            items={overflowItems}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            menuId={menuId}
            labelledBy={overflowButtonId}
            buttonRef={overflowButtonRef}
          />
        </div>
      ) : null}
    </nav>
  );
}

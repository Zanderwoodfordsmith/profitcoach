"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

type BossProNavToggleProps = {
  /** Full labels vs icon rail (desktop). */
  expanded: boolean;
  onToggle: () => void;
  /** Tucked away while something in the sidebar (the account menu) sits over this spot. */
  hidden?: boolean;
};

/** The open native dialog (search), whose subtree is the only part of the page left clickable. */
function openDialog(): HTMLElement | null {
  const open = document.querySelectorAll<HTMLElement>("dialog[open]");
  return open.length ? open[open.length - 1] : null;
}

const pickHost = () => openDialog() ?? document.body;

function watchDialogs(onChange: () => void) {
  const watch = new MutationObserver(onChange);
  watch.observe(document.body, { subtree: true, childList: true, attributeFilter: ["open"] });
  return () => watch.disconnect();
}

/**
 * Sits where the line above Support meets the sidebar edge. Desktop only, as
 * the sidebar is: phones always show the bottom nav.
 *
 * Drawn on the body (or inside an open search dialog) at a fixed spot tracked
 * from the sidebar, so it stays in front of the glass modal and search blur
 * instead of being trapped in the sidebar's layer.
 */
export function BossProNavToggle({ expanded, onToggle, hidden = false }: BossProNavToggleProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null);
  const host = useSyncExternalStore(watchDialogs, pickHost, () => null);

  useEffect(() => {
    const anchor = anchorRef.current;
    const row = anchor?.parentElement;
    if (!anchor || !row) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      setSpot((prev) =>
        prev && prev.left === rect.left && prev.top === rect.top ? prev : { left: rect.left, top: rect.top }
      );
    };
    // Fires once on observe, then as the sidebar's width animates and the row's contents change.
    const resize = new ResizeObserver(place);
    resize.observe(row);
    const rail = row.closest("aside");
    if (rail) resize.observe(rail);
    window.addEventListener("resize", place);
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);


  return (
    <>
      <span ref={anchorRef} className="pointer-events-none absolute right-0 top-0 h-0 w-0" aria-hidden />
      {host && spot && !hidden
        ? createPortal(
            <button
              type="button"
              onClick={onToggle}
              style={{ left: spot.left, top: spot.top }}
              className="fixed z-[90] hidden h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0c5290] text-white shadow-md hover:bg-[#1664b6] md:flex"
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              {expanded ? (
                <ChevronLeft className="h-3 w-3 shrink-0" strokeWidth={2.75} aria-hidden />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2.75} aria-hidden />
              )}
            </button>,
            host
          )
        : null}
    </>
  );
}

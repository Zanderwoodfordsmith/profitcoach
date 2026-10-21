"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

/** How long a pointer rests on a visible label before its card appears. */
const REST_DELAY_MS = 500;

const HINT_SELECTOR = "[data-hint-label]";

type Shown = {
  label: string;
  description: string | null;
  left: number;
  top: number;
};

/**
 * Hover cards for navigation. Anything inside `container` with
 * `data-hint-label` (and optionally `data-hint-description`) gets one.
 *
 * - `instant`: icon-only nav (the collapsed sidebar). Every hint shows at once.
 * - `rest`: the name is already on screen, so only hints with a description
 *   show, and only after the pointer rests. Once a card is up, moving to the
 *   next item swaps it straight away.
 *
 * Rendered in a portal so scrolling nav lists and tab rows do not clip it.
 */
export function NavHoverHints({
  container,
  mode,
  placement,
  enabled = true,
}: {
  container: RefObject<HTMLElement | null>;
  mode: "instant" | "rest";
  placement: "right" | "below";
  enabled?: boolean;
}) {
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!enabled || !el) return;
    let timer: number | null = null;
    let open = false;

    function clearTimer() {
      if (timer != null) window.clearTimeout(timer);
      timer = null;
    }
    function hide() {
      clearTimer();
      open = false;
      setShown(null);
    }
    function show(target: EventTarget | null) {
      const anchor =
        target instanceof Element
          ? target.closest<HTMLElement>(HINT_SELECTOR)
          : null;
      const label = anchor?.dataset.hintLabel?.trim();
      const description = anchor?.dataset.hintDescription?.trim() || null;
      // An open menu already sits where the card would go.
      if (
        !anchor ||
        !label ||
        (mode === "rest" && !description) ||
        anchor.getAttribute("aria-expanded") === "true"
      ) {
        hide();
        return;
      }
      const place = () => {
        const box = anchor.getBoundingClientRect();
        open = true;
        setShown(
          placement === "right"
            ? { label, description, left: box.right + 10, top: box.top + box.height / 2 }
            : {
                label,
                description,
                // Centred under the tab, but kept clear of the window edges (card is at most 15rem).
                left: Math.min(
                  Math.max(box.left + box.width / 2, 128),
                  window.innerWidth - 128
                ),
                top: box.bottom + 8,
              }
        );
      };
      clearTimer();
      if (mode === "instant" || open) place();
      else timer = window.setTimeout(place, REST_DELAY_MS);
    }

    const onPointerOver = (e: PointerEvent) => {
      // Touch fires pointerover on tap; the card would only flash before navigating.
      if (e.pointerType !== "mouse") return;
      show(e.target);
    };
    const onPointerOut = (e: PointerEvent) => {
      const next = e.relatedTarget;
      const stillOnHint =
        next instanceof Element && el.contains(next) && next.closest(HINT_SELECTOR);
      if (!stillOnHint) hide();
    };
    const onFocusIn = (e: FocusEvent) => show(e.target);

    el.addEventListener("pointerover", onPointerOver);
    el.addEventListener("pointerout", onPointerOut);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", hide);
    el.addEventListener("click", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      hide();
      el.removeEventListener("pointerover", onPointerOver);
      el.removeEventListener("pointerout", onPointerOut);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", hide);
      el.removeEventListener("click", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [container, enabled, mode, placement]);

  if (!enabled || !shown || typeof document === "undefined") return null;
  return createPortal(
    <div
      aria-hidden
      style={{ left: shown.left, top: shown.top }}
      className={`pointer-events-none fixed z-[96] rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] ${
        placement === "right" ? "-translate-y-1/2" : "-translate-x-1/2"
      } ${shown.description ? "w-max max-w-[15rem]" : "whitespace-nowrap"}`}
    >
      <p className="text-sm font-semibold leading-snug text-slate-900">
        {shown.label}
      </p>
      {shown.description ? (
        <p className="mt-0.5 text-xs leading-snug text-slate-500">
          {shown.description}
        </p>
      ) : null}
    </div>,
    document.body
  );
}

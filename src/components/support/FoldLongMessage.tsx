"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Fold only past this many lines, so "See more" never hides just a line or two. */
const FOLD_OVER_LINES = 15;
/** A folded message shows this many lines. */
const SHOW_LINES = 10;

function lineHeightOf(el: Element): number {
  const style = getComputedStyle(el);
  const lh = parseFloat(style.lineHeight);
  if (Number.isFinite(lh)) return lh;
  return parseFloat(style.fontSize) * 1.6;
}

/**
 * One rule for every Support message (19 Nov): text longer than fifteen
 * lines folds to ten, with a fade and "See more"; anything up to fifteen
 * shows in full. The fade is a mask, so it works on any bubble colour.
 */
export function FoldLongMessage({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [foldHeight, setFoldHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => {
      const lh = lineHeightOf(el.firstElementChild ?? el);
      setFoldHeight(el.scrollHeight > lh * FOLD_OVER_LINES + 1 ? lh * SHOW_LINES : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [expanded, children]);

  const long = foldHeight !== null;

  return (
    <div className={className}>
      <div
        ref={ref}
        style={!expanded && long ? { maxHeight: foldHeight } : undefined}
        className={
          !expanded && long
            ? "overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
            : undefined
        }
      >
        {children}
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-sky-600 hover:text-sky-500 hover:underline"
        >
          {expanded ? "See less" : "See more"}
        </button>
      ) : null}
    </div>
  );
}

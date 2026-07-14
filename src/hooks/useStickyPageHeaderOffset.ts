"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Measures a sticky page header element's height for table sticky offsets.
 * Re-measure when `deps` change (e.g. loading or expandable form visibility).
 */
export function useStickyPageHeaderOffset(
  deps: readonly unknown[] = []
): {
  pageHeaderRef: React.RefObject<HTMLDivElement | null>;
  pageHeaderHeight: number;
} {
  const pageHeaderRef = useRef<HTMLDivElement>(null);
  const [pageHeaderHeight, setPageHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const el = pageHeaderRef.current;
    if (!el) return;

    const measure = () => {
      setPageHeaderHeight(Math.round(el.getBoundingClientRect().height));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls remount triggers
  }, deps);

  return { pageHeaderRef, pageHeaderHeight };
}

export type OverflowNavMode = "all" | "more" | "menu";

export type OverflowNavPlan = {
  mode: OverflowNavMode;
  visibleIndices: number[];
  overflowIndices: number[];
};

/** If not even one tab fits beside More, collapse to a hamburger. */
export const OVERFLOW_NAV_MIN_VISIBLE_TABS = 1;

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function rowWidth(widths: number[], gap: number): number {
  if (widths.length === 0) return 0;
  return widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
}

/**
 * Keep the leading tabs plus the active one. If the active tab would overflow,
 * it replaces the last visible slot so the current section stays on the bar.
 */
export function visibleIndicesForCount(
  count: number,
  total: number,
  activeIndex: number
): number[] {
  if (count <= 0) return [];
  if (count >= total) return range(total);
  const indices = range(count);
  const active = Math.min(Math.max(activeIndex, 0), total - 1);
  if (active >= count) {
    indices[count - 1] = active;
  }
  return indices;
}

/**
 * Plan a single-row tab strip: show every tab when they fit, otherwise keep
 * as many as possible plus a "More" control, or a hamburger when not even
 * one tab fits beside that control.
 */
export function planOverflowNav(opts: {
  itemWidths: number[];
  availableWidth: number;
  moreWidth: number;
  gap: number;
  activeIndex: number;
  minVisibleTabs?: number;
}): OverflowNavPlan {
  const {
    itemWidths,
    availableWidth,
    moreWidth,
    gap,
    activeIndex,
    minVisibleTabs = OVERFLOW_NAV_MIN_VISIBLE_TABS,
  } = opts;
  const n = itemWidths.length;
  if (n === 0) {
    return { mode: "all", visibleIndices: [], overflowIndices: [] };
  }

  if (sumFits(itemWidths, gap, availableWidth)) {
    return {
      mode: "all",
      visibleIndices: range(n),
      overflowIndices: [],
    };
  }

  let best = 0;
  for (let k = n - 1; k >= 1; k -= 1) {
    const visible = visibleIndicesForCount(k, n, activeIndex);
    const used = rowWidth(
      [...visible.map((i) => itemWidths[i] ?? 0), moreWidth],
      gap
    );
    if (used <= availableWidth) {
      best = k;
      break;
    }
  }

  const minVisible = Math.min(minVisibleTabs, Math.max(n - 1, 1));
  if (best < minVisible) {
    return {
      mode: "menu",
      visibleIndices: [],
      overflowIndices: range(n),
    };
  }

  const visibleIndices = visibleIndicesForCount(best, n, activeIndex);
  return {
    mode: "more",
    visibleIndices,
    overflowIndices: range(n).filter((i) => !visibleIndices.includes(i)),
  };
}

function sumFits(widths: number[], gap: number, availableWidth: number): boolean {
  return rowWidth(widths, gap) <= availableWidth;
}

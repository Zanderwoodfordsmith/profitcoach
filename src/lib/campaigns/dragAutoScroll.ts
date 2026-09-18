/**
 * HTML5 drag-and-drop does not reliably scroll the page when the pointer
 * approaches the sticky header. Compute a per-frame scroll delta so a drag
 * toward the top (or bottom) of the sequence can keep moving.
 */

export const DRAG_AUTO_SCROLL_EDGE_TOP_PX = 120;
export const DRAG_AUTO_SCROLL_EDGE_BOTTOM_PX = 80;
export const DRAG_AUTO_SCROLL_MAX_PX = 18;

export function dragAutoScrollDelta(
  clientY: number,
  viewportTop: number,
  viewportBottom: number,
  options?: {
    edgeTopPx?: number;
    edgeBottomPx?: number;
    maxPx?: number;
  }
): number {
  if (!Number.isFinite(clientY) || viewportBottom <= viewportTop) return 0;

  const edgeTop = options?.edgeTopPx ?? DRAG_AUTO_SCROLL_EDGE_TOP_PX;
  const edgeBottom = options?.edgeBottomPx ?? DRAG_AUTO_SCROLL_EDGE_BOTTOM_PX;
  const maxPx = options?.maxPx ?? DRAG_AUTO_SCROLL_MAX_PX;
  if (edgeTop <= 0 || edgeBottom <= 0 || maxPx <= 0) return 0;

  if (clientY < viewportTop + edgeTop) {
    const intensity = Math.min(1, (viewportTop + edgeTop - clientY) / edgeTop);
    return -Math.max(1, Math.round(maxPx * intensity));
  }

  if (clientY > viewportBottom - edgeBottom) {
    const intensity = Math.min(
      1,
      (clientY - (viewportBottom - edgeBottom)) / edgeBottom
    );
    return Math.max(1, Math.round(maxPx * intensity));
  }

  return 0;
}

function nearestVerticalScroller(start: Element | null): HTMLElement | null {
  let el: HTMLElement | null =
    start instanceof HTMLElement ? start : start?.parentElement ?? null;
  while (el && el !== document.documentElement && el !== document.body) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      el.scrollHeight > el.clientHeight + 1
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export function startDragAutoScroll(root?: Element | null): () => void {
  let lastY: number | null = null;
  let raf = 0;
  const scroller = nearestVerticalScroller(root ?? null);

  function viewport(): { top: number; bottom: number } {
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }
    return { top: 0, bottom: window.innerHeight };
  }

  function apply(delta: number) {
    if (scroller) {
      scroller.scrollTop += delta;
      return;
    }
    window.scrollBy(0, delta);
  }

  function tick() {
    raf = 0;
    if (lastY == null) return;
    const box = viewport();
    const delta = dragAutoScrollDelta(lastY, box.top, box.bottom);
    if (delta === 0) return;
    apply(delta);
    raf = requestAnimationFrame(tick);
  }

  function onDragOver(event: DragEvent) {
    // Some browsers fire a dummy dragover at (0, 0). Ignore that, but still
    // treat a real pointer parked at the top-left as an edge scroll.
    if (event.clientX === 0 && event.clientY === 0) return;
    lastY = event.clientY;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  document.addEventListener("dragover", onDragOver, true);
  return () => {
    document.removeEventListener("dragover", onDragOver, true);
    if (raf) cancelAnimationFrame(raf);
  };
}

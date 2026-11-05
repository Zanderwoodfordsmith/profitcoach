"use client";

/**
 * Ava moving between her own page and the side panel (5 Nov): the room
 * shrinks into the panel (or grows out of it) with a glowing edge, her halo
 * and the message box fly to their new places, and the page behind fades in.
 * Built on the browser's view transitions; where those are missing, or the
 * person asks for less motion, it simply goes. The look is in ava.css.
 */

type Direction = "dock" | "open";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> };
};

/** The new view is ready once the panel (or her page) is in and the other has gone. */
function arrived(direction: Direction): boolean {
  const panel = document.querySelector(".ava-dock");
  const page = document.querySelector(".ava-room-column");
  return direction === "dock" ? Boolean(panel) && !page : Boolean(page) && !panel;
}

function waitFor(direction: Direction): Promise<void> {
  return new Promise((resolve) => {
    let timer = 0;
    const observer = new MutationObserver(() => {
      if (arrived(direction)) done();
    });
    function done() {
      observer.disconnect();
      window.clearTimeout(timer);
      resolve();
    }
    // Never hold the screen if the page is slow.
    timer = window.setTimeout(done, 2000);
    observer.observe(document.body, { childList: true, subtree: true });
    if (arrived(direction)) done();
  });
}

export function morphAva(direction: Direction, go: () => void): void {
  const doc = document as ViewTransitionDocument;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still || !doc.startViewTransition) {
    go();
    return;
  }
  const root = document.documentElement;
  const classes = ["ava-morph", `ava-morph-${direction}`];
  root.classList.add(...classes);
  const transition = doc.startViewTransition(() => {
    go();
    return waitFor(direction);
  });
  void transition.finished.finally(() => root.classList.remove(...classes));
}

"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Which item in a list is being read as the page scrolls. Each item has its own trigger line, the first at 65% down
 * the screen and the last at 35%, so the first takes focus early, the last late, and each holds it longer than the
 * gap between them. Returns -1 before the first and once the last has passed near the top. Off for reduced motion.
 */
export function useScrollFocus(ref: RefObject<HTMLElement | null>, selector = "li") {
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(selector));
    let frame = 0;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const last = items.length - 1;
      let next = -1;
      items.forEach((item, i) => {
        const r = item.getBoundingClientRect();
        const trigger = vh * (0.65 - (0.3 * i) / Math.max(1, last));
        if (r.top + r.height / 2 <= trigger) next = i;
      });
      const lastRect = items[last]?.getBoundingClientRect();
      if (lastRect && lastRect.bottom < vh * 0.15) next = -1;
      setActive(next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, selector]);

  return active;
}

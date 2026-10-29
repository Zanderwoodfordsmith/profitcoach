"use client";

import { useEffect } from "react";

/**
 * The page's motion, kept in one place: the nav turns solid once you scroll, the hero layers
 * drift at different depths (scroll, plus the pointer on a mouse), and marked blocks fade up
 * as they arrive. Content is visible without this; reduced motion skips all of it.
 */
export function PremiumMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-motion-root]");
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = root.querySelector<HTMLElement>("[data-motion-nav]");
    const hero = root.querySelector<HTMLElement>("[data-motion-hero]");
    const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-depth]"));

    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;

    const render = () => {
      frame = 0;
      const y = window.scrollY;
      nav?.classList.toggle("is-solid", y > 40);
      if (reduced || !hero) return;
      const heroH = hero.offsetHeight;
      if (y > heroH) return;
      for (const el of layers) {
        const depth = Number(el.dataset.depth) || 0;
        const tx = pointerX * depth * 40;
        const ty = y * depth + pointerY * depth * 24;
        el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointerX = e.clientX / window.innerWidth - 0.5;
      pointerY = e.clientY / window.innerHeight - 0.5;
      schedule();
    };

    window.addEventListener("scroll", schedule, { passive: true });
    if (!reduced && window.matchMedia("(pointer: fine)").matches) {
      hero?.addEventListener("pointermove", onPointer);
    }
    render();

    let observer: IntersectionObserver | null = null;
    if (!reduced) {
      root.classList.add("bp-motion");
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              observer?.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -12% 0px" }
      );
      root.querySelectorAll("[data-reveal]").forEach((el) => observer?.observe(el));
    }

    return () => {
      window.removeEventListener("scroll", schedule);
      hero?.removeEventListener("pointermove", onPointer);
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

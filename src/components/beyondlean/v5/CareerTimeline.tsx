"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Stop = { year: string; role: string; place: string; note: string };

/**
 * Paul's career as a horizontal timeline. As the section scrolls up the page, a blue line draws left to right and
 * each year lights as the line reaches it. Reduced motion shows it fully drawn (in the CSS).
 */
export function CareerTimeline({ stops }: { stops: Stop[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduced motion: the CSS shows the timeline fully drawn, so there's nothing to track
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Starts as the timeline enters the lower part of the screen, done by the time it reaches the upper third
      const start = vh * 0.9;
      const end = vh * 0.35;
      const p = (start - r.top) / (start - end);
      setProgress(Math.min(1, Math.max(0, p)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  const n = stops.length;
  return (
    <div className="v5-tl-scroll">
      <ol ref={ref} className="v5-tl" style={{ "--tl-p": progress, "--tl-n": n } as CSSProperties}>
        {stops.map((c, i) => {
          // Each stop sits in the middle of its column; it lights once the line passes it
          const at = (i + 0.5) / n;
          return (
            <li key={c.year} className={progress >= at ? "is-on" : undefined}>
              <span className="v5-tl-year">{c.year}</span>
              <span className="v5-tl-dot" aria-hidden />
              <strong>{c.role}</strong>
              <span className="v5-tl-place">{c.place}</span>
              <p>{c.note}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

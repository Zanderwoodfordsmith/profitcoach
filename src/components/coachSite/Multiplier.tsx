"use client";

import { useEffect, useRef, useState } from "react";

const LEVERS = [
  "Leads a month",
  "Leads that become meetings",
  "Meetings that become sales",
  "Average sale value",
  "Times a client buys a year",
];

/**
 * Pinned scroll: five levers light up one by one as you scroll, and the total
 * multiplies by 1.1 each time, ending on 1.61 (the cleared funnel maths).
 */
export function Multiplier({ firstName }: { firstName: string }) {
  const ref = useRef<HTMLElement>(null);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (reduce) {
        setLit(LEVERS.length);
        return;
      }
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const progress = travel > 0 ? Math.min(Math.max(-rect.top / travel, 0), 1) : 1;
      // The first lever lights a little after the pin starts; the last well before it ends.
      setLit(Math.min(LEVERS.length, Math.max(0, Math.floor((progress - 0.08) / 0.15) + 1)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const total = Math.pow(1.1, lit);

  return (
    <section className="cs-multi" ref={ref} aria-labelledby="cs-multi-title">
      <div className="cs-multi__stage cs-on-dark">
        <div className="cs-wrap cs-multi__grid">
          <div style={{ display: "grid", gap: 28 }}>
            <h2 id="cs-multi-title" className="cs-tw cs-h2">
              <span className="cs-tw__light">Small gains multiply.</span>
              <span className="cs-tw__bold">Five levers, ten percent each.</span>
            </h2>
            <p className="cs-lead">
              Every sale runs through the same five numbers. Improve each one by 10% and they compound:
              1.1 × 1.1 × 1.1 × 1.1 × 1.1 is 1.61. That is 61% more revenue without a single big bet.
              {` ${firstName}`} works out which lever moves first in your business.
            </p>
            <div className="cs-multi__total" aria-live="polite">
              <small>×</small>
              {total.toFixed(2)}
            </div>
          </div>
          <ol className="cs-multi__levers">
            {LEVERS.map((lever, i) => (
              <li key={lever} data-on={i < lit}>
                <b>{lever}</b>
                <span>+10%</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

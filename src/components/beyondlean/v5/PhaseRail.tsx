"use client";

import { useEffect, useState } from "react";

type Step = { id: string; num: string; title: string };

/**
 * The sticky rail beside the three steps on How it works: the line fills as you scroll through the
 * chapters and the step you're reading lights up. Chapters are found by id, so they stay server-rendered.
 */
export function PhaseRail({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const ids = steps.map((s) => s.id).join(",");

  useEffect(() => {
    const els = ids
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const mid = window.innerHeight * 0.5;
      const top = els[0].getBoundingClientRect().top;
      const bottom = els[els.length - 1].getBoundingClientRect().bottom;
      setProgress(Math.min(1, Math.max(0, (mid - top) / (bottom - top))));
      let current = 0;
      els.forEach((el, i) => {
        if (el.getBoundingClientRect().top < mid) current = i;
      });
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ids]);

  return (
    <nav className="v5-how-rail" aria-label="The three steps">
      <div className="v5-how-rail-track" aria-hidden>
        <span style={{ transform: `scaleY(${progress})` }} />
      </div>
      <ol>
        {steps.map((s, i) => (
          <li key={s.id} className={i === active ? "is-active" : i < active ? "is-done" : undefined}>
            <a href={`#${s.id}`} aria-current={i === active ? "step" : undefined}>
              <span className="v5-how-rail-num">{s.num}</span>
              <span className="v5-how-rail-title">{s.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

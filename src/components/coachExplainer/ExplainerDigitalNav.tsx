"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type DigitalNavItem = { id: string; title: string; sub?: boolean };

/**
 * The explainer's side menu: sticky beside the reading column on a laptop, a
 * contents panel under a slim top bar on a phone. It follows the reader down
 * the page, and carries the page's actions (the explainer: take the BOSS
 * Score, save the PDF; a proposal: sign, save the PDF).
 */
export function ExplainerDigitalNav({
  items,
  coachName,
  actions,
}: {
  items: DigitalNavItem[];
  coachName: string;
  actions: ReactNode;
}) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Current = the last section whose top has passed the upper third of the screen.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight / 3;
      let next = items[0]?.id ?? "";
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= line) next = item.id;
      }
      // At the very bottom the last section can't reach the line: it's the one being read.
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const last = items[items.length - 1];
      if (atEnd && last && document.getElementById(last.id)) next = last.id;
      setActive(next);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  const current = items.find((item) => item.id === active) ?? items[0];

  const list = (
    <ol className="cxd-nav__list">
      {items.map((item) => (
        <li key={item.id} className={item.sub ? "is-sub" : undefined}>
          <a href={`#${item.id}`} aria-current={item.id === active ? "location" : undefined} onClick={() => setOpen(false)}>
            {item.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <nav className="cxd-nav" aria-label="Contents">
        <p className="cxd-nav__who">{coachName}</p>
        {list}
        <div className="cxd-nav__actions">{actions}</div>
      </nav>

      <div className={`cxd-bar${open ? " is-open" : ""}`}>
        <button type="button" className="cxd-bar__toggle" aria-expanded={open} aria-controls="cxd-bar-panel" onClick={() => setOpen((v) => !v)}>
          <span className="cxd-bar__label">Contents</span>
          <span className="cxd-bar__current">{current?.title}</span>
          <ChevronDown size={18} strokeWidth={2} aria-hidden="true" className="cxd-bar__chevron" />
        </button>
        <div id="cxd-bar-panel" className="cxd-bar__panel" hidden={!open}>
          {list}
          <div className="cxd-nav__actions">{actions}</div>
        </div>
      </div>
    </>
  );
}

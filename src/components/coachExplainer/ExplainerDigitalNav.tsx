"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, FileDown } from "lucide-react";

export type DigitalNavItem = { id: string; title: string; sub?: boolean };

/**
 * The explainer's side menu: sticky beside the reading column on a laptop, a
 * contents panel under a slim top bar on a phone. It follows the reader down
 * the page, and carries the two actions: save the PDF, take the BOSS Score.
 */
export function ExplainerDigitalNav({
  items,
  coachName,
  pdfHref,
  scoreHref,
}: {
  items: DigitalNavItem[];
  coachName: string;
  pdfHref: string;
  scoreHref: string;
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

  const actions = (
    <div className="cxd-nav__actions">
      <a className="cxd-btn cxd-btn--solid" href={scoreHref}>
        Take your BOSS Score
        <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
      </a>
      <a className="cxd-btn cxd-btn--quiet" href={pdfHref} target="_blank" rel="noopener">
        <FileDown size={16} strokeWidth={2} aria-hidden="true" />
        Save as PDF
      </a>
    </div>
  );

  return (
    <>
      <nav className="cxd-nav" aria-label="Contents">
        <p className="cxd-nav__who">{coachName}</p>
        {list}
        {actions}
      </nav>

      <div className={`cxd-bar${open ? " is-open" : ""}`}>
        <button type="button" className="cxd-bar__toggle" aria-expanded={open} aria-controls="cxd-bar-panel" onClick={() => setOpen((v) => !v)}>
          <span className="cxd-bar__label">Contents</span>
          <span className="cxd-bar__current">{current?.title}</span>
          <ChevronDown size={18} strokeWidth={2} aria-hidden="true" className="cxd-bar__chevron" />
        </button>
        <div id="cxd-bar-panel" className="cxd-bar__panel" hidden={!open}>
          {list}
          {actions}
        </div>
      </div>
    </>
  );
}

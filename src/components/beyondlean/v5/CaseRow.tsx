"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CaseRowItem = {
  slug: string;
  title: string;
  sector: string;
  summary: string;
  photo: string;
};

/** A row of cards that scrolls sideways, with arrows and a progress line under it. Cards must be links. */
export function SlideRow({ children, label }: { children: React.ReactNode; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setSeen(el.scrollWidth > 0 ? (el.clientWidth + el.scrollLeft) / el.scrollWidth : 1);
      setAtStart(el.scrollLeft < 4);
      setAtEnd(el.scrollLeft > max - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const move = (dir: 1 | -1) => {
    const el = track.current;
    const card = el?.querySelector("a");
    if (!el || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 20) * 2, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="v5-row">
      <div className="v5-row-track" ref={track}>
        {children}
      </div>
      <div className="v5-wrap v5-row-controls">
        <span className="v5-row-progress" aria-hidden>
          <span style={{ transform: `scaleX(${Math.min(1, seen)})` }} />
        </span>
        <span className="v5-row-buttons">
          <button type="button" onClick={() => move(-1)} disabled={atStart} aria-label={`Previous ${label}`}>
            <ChevronLeft aria-hidden />
          </button>
          <button type="button" onClick={() => move(1)} disabled={atEnd} aria-label={`Next ${label}`}>
            <ChevronRight aria-hidden />
          </button>
        </span>
      </div>
    </div>
  );
}

/** Tall photo cards for the case studies. */
export function CaseRow({ items, base }: { items: CaseRowItem[]; base: string }) {
  return (
    <SlideRow label="case studies">
      {items.map((c) => (
        <Link key={c.slug} className="v5-row-card" href={`${base}/${c.slug}`}>
          {c.photo && <Image src={c.photo} alt="" fill sizes="340px" />}
          {c.sector && <span className="v5-row-tag">{c.sector}</span>}
          <span className="v5-row-copy">
            <span className="v5-row-title">{c.title}</span>
            <span className="v5-row-summary">{c.summary}</span>
          </span>
        </Link>
      ))}
    </SlideRow>
  );
}

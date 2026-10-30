"use client";

import { useRef } from "react";
import { Quote } from "lucide-react";
import { useScrollFocus } from "./useScrollFocus";

/**
 * The owners' own words. Each quote fades up in turn; the one being read grows slightly and the rest turn a touch
 * greyer. React never sets the li's class: the scroll reveal adds "is-in" there.
 */
export function QuoteList({ quotes }: { quotes: string[] }) {
  const list = useRef<HTMLUListElement>(null);
  const active = useScrollFocus(list);

  return (
    <ul className={`v5-problem-quotes${active >= 0 ? " has-focus" : ""}`} ref={list}>
      {quotes.map((q, i) => (
        <li key={q} data-reveal style={{ transitionDelay: `${i * 110}ms` }}>
          <span className={`v5-q${i === active ? " is-focus" : ""}`}>
            <Quote aria-hidden />
            {q}
          </span>
        </li>
      ))}
    </ul>
  );
}

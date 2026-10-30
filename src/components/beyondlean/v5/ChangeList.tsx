"use client";

import { useRef } from "react";
import { Check, X } from "lucide-react";
import { useScrollFocus } from "./useScrollFocus";

export type Change = { cost: string; gain: string; text: string };

/**
 * What changes: each item shows the cost now, then the good outcome. As the page scrolls, the one being read grows,
 * the ones already read stay as they are, and the ones still to come wait a touch greyer. Nothing is ever hidden.
 * React never sets the li's class: the scroll reveal adds "is-in" there.
 */
export function ChangeList({ items }: { items: Change[] }) {
  const list = useRef<HTMLOListElement>(null);
  const active = useScrollFocus(list);

  return (
    <ol className={`v5-changes${active >= 0 ? " has-focus" : ""}`} ref={list}>
      {items.map((c, i) => (
        <li key={c.gain} data-reveal>
          <div className={`v5-change${i === active ? " is-focus" : active >= 0 && i > active ? " is-next" : ""}`}>
            <p className="v5-change-cost">
              <X aria-hidden /> {c.cost}
            </p>
            <h3 className="v5-change-gain">
              <span className="v5-change-tick" aria-hidden>
                <Check />
              </span>
              {c.gain}
            </h3>
            <p className="v5-change-text">{c.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

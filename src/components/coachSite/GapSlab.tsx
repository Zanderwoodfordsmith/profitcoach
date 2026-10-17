"use client";

import { useEffect, useRef, useState } from "react";
import type { CoachSiteGapRow } from "@/lib/coachSite/types";

type Props = {
  rows: CoachSiteGapRow[];
  firstName: string;
};

type View = "today" | "want";

/**
 * Two layers of the same list: today on white, what they want on the navy band.
 * Switching wipes the navy layer across. It plays once on load, then the toggle
 * is theirs. It always comes to rest on one whole side, never half and half.
 */
export function GapSlab({ rows, firstName }: Props) {
  const [view, setView] = useState<View>("today");
  const touched = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!touched.current) setView("want");
    }, 1600);
    return () => window.clearTimeout(timer);
  }, []);

  const list = rows.slice(0, 4);
  const choose = (next: View) => {
    touched.current = true;
    setView(next);
  };

  return (
    <div className="cs-slabwrap">
      <div className="cs-toggle" role="group" aria-label="Show">
        <button type="button" aria-pressed={view === "today"} onClick={() => choose("today")}>
          Today
        </button>
        <button type="button" aria-pressed={view === "want"} onClick={() => choose("want")}>
          With {firstName}
        </button>
      </div>
      <div className="cs-slab" data-view={view}>
        <div className="cs-slab__layer cs-slab__layer--today" aria-hidden={view !== "today"}>
          <div className="cs-slab__tag">
            Today <span>Where most owners are</span>
          </div>
          <ul className="cs-slab__rows">
            {list.map((r) => (
              <li key={r.today}>
                <span>{r.today}</span>
                <span aria-hidden="true">{r.want}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="cs-slab__layer cs-slab__layer--want" aria-hidden={view !== "want"}>
          <div className="cs-slab__tag">
            What you want <span>With {firstName}</span>
          </div>
          <ul className="cs-slab__rows">
            {list.map((r) => (
              <li key={r.want}>
                <span aria-hidden="true">{r.today}</span>
                <span>{r.want}</span>
              </li>
            ))}
          </ul>
        </div>
        <span className="cs-slab__edge" aria-hidden="true" />
      </div>
    </div>
  );
}

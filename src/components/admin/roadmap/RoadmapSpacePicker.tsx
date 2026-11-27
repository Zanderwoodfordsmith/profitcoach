"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useDismiss } from "./roadmapUi";
import { ROADMAP_SPACES, type RoadmapSpace } from "./spaces";

export type SpaceChoice = RoadmapSpace | "all";

const KEY = "roadmap-space";

/** The space picked last time on this browser (All spaces if none). */
export function readSpaceChoice(): SpaceChoice {
  try {
    const v = window.localStorage.getItem(KEY);
    return (ROADMAP_SPACES as readonly string[]).includes(v ?? "") ? (v as RoadmapSpace) : "all";
  } catch {
    return "all";
  }
}

export function saveSpaceChoice(choice: SpaceChoice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // Remembering the space is only a convenience.
  }
}

/** Pick one space (or all): first in the toolbar, before the views. */
export function RoadmapSpacePicker({ value, onChange }: { value: SpaceChoice; onChange: (next: SpaceChoice) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const options: { key: SpaceChoice; label: string }[] = [
    { key: "all", label: "All spaces" },
    ...ROADMAP_SPACES.map((s) => ({ key: s, label: s })),
  ];
  const current = options.find((o) => o.key === value) ?? options[0];
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Space: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
      >
        {current.label}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-[90] mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]"
        >
          {options.map((o, i) => (
            <button
              key={o.key}
              type="button"
              role="menuitemradio"
              aria-checked={o.key === value}
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-50 ${
                i === 1 ? "mt-1 border-t border-slate-100 pt-2" : ""
              }`}
            >
              <span className="flex-1">{o.label}</span>
              {o.key === value ? <Check className="h-4 w-4 text-sky-600" aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

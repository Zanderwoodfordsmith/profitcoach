"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Play } from "lucide-react";
import { ROADMAP_SCORES } from "@/lib/roadmap/types";

/** Shared pieces of the roadmap views (List, Projects): score pills, dropdowns, the group caret. */

/** Red at 1 up to green at 5, for impact, ease and their total. */
export const SCORE_TONE: Record<number, { fill: string; text: string; soft: string }> = {
  1: { fill: "bg-rose-500", text: "text-rose-700", soft: "bg-rose-50" },
  2: { fill: "bg-orange-400", text: "text-orange-700", soft: "bg-orange-50" },
  3: { fill: "bg-amber-400", text: "text-amber-700", soft: "bg-amber-50" },
  4: { fill: "bg-lime-500", text: "text-lime-700", soft: "bg-lime-50" },
  5: { fill: "bg-emerald-500", text: "text-emerald-700", soft: "bg-emerald-50" },
};

export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);
  return ref;
}

export function MetaDropdown({
  display,
  options,
  onClear,
  bare = false,
}: {
  display: React.ReactNode;
  options: { key: string; node: React.ReactNode; selected: boolean; onSelect: () => void }[];
  onClear?: () => void;
  /** The display is its own pill, chevron included. */
  bare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative inline-flex max-w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          bare
            ? "inline-flex max-w-full rounded-full px-1 py-0.5 text-left transition hover:opacity-90"
            : "inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition hover:bg-slate-100"
        }
      >
        {display}
        {bare ? null : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                o.onSelect();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <span className="flex flex-1 items-center gap-2">{o.node}</span>
              {o.selected ? <Check className="h-4 w-4 text-slate-500" aria-hidden /> : null}
            </button>
          ))}
          {onClear ? (
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="mt-1 w-full rounded-lg border-t border-slate-100 px-2 py-1.5 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Score as one coloured pill: number and short name, red at 1 to green at 5. */
export function ScorePill({
  value,
  name,
  chevron = false,
}: {
  value: number | null;
  name?: string;
  chevron?: boolean;
}) {
  if (!value) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-sm text-slate-500">
        Set
        {chevron ? <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden /> : null}
      </span>
    );
  }
  const tone = SCORE_TONE[value];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${tone.soft} ${tone.text}`}
    >
      <span className="tabular-nums">{value}</span>
      {name ? <span className="font-medium">{name}</span> : null}
      {chevron ? <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden /> : null}
    </span>
  );
}

export function ScoreDropdown({
  value,
  names,
  onChange,
}: {
  value: number | null;
  names: Record<number, string>;
  onChange: (value: number | null) => void;
}) {
  return (
    <MetaDropdown
      bare
      display={<ScorePill value={value} name={value ? names[value] : undefined} chevron />}
      options={[...ROADMAP_SCORES].reverse().map((n) => ({
        key: String(n),
        selected: value === n,
        onSelect: () => onChange(n),
        node: <ScorePill value={n} name={names[n]} />,
      }))}
      onClear={value ? () => onChange(null) : undefined}
    />
  );
}

export function Caret({ open }: { open: boolean }) {
  return (
    <Play
      aria-hidden
      fill="currentColor"
      strokeWidth={0}
      className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${
        open ? "rotate-90" : ""
      }`}
    />
  );
}


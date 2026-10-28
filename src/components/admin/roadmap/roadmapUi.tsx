"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Play } from "lucide-react";
import { ROADMAP_SCORES, type RoadmapStatus } from "@/lib/roadmap/types";

/** Shared pieces of the roadmap views (List, Projects): score pills, dropdowns, the group caret. */

/** Each status's name and chip colour, wherever the roadmap shows one. */
export const ROADMAP_STATUS_META: Record<RoadmapStatus, { label: string; chip: string }> = {
  todo: { label: "To do", chip: "bg-slate-200/80 text-slate-700" },
  up_next: { label: "Up next", chip: "bg-orange-100 text-orange-800" },
  in_progress: { label: "In progress", chip: "bg-blue-100 text-blue-800" },
  review: { label: "Review", chip: "bg-yellow-200/80 text-yellow-900" },
  done: { label: "Ready", chip: "bg-emerald-100 text-emerald-800" },
  staged: { label: "On staging", chip: "bg-cyan-100 text-cyan-800" },
  live: { label: "Live", chip: "bg-slate-300/80 text-slate-700" },
  evaluate: { label: "Evaluate", chip: "bg-violet-100 text-violet-800" },
  parked: { label: "Parked", chip: "bg-slate-200/70 text-slate-500" },
  vetoed: { label: "Vetoed", chip: "bg-rose-100 text-rose-700" },
};

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
  alignRight = false,
}: {
  display: React.ReactNode;
  options: { key: string; node: React.ReactNode; selected: boolean; onSelect: () => void }[];
  onClear?: () => void;
  /** The display is its own pill, chevron included. */
  bare?: boolean;
  /** Open the menu leftwards, for cells at the right edge. */
  alignRight?: boolean;
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
        <div className={`absolute top-full z-30 mt-1 ${alignRight ? "right-0" : "left-0"} min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg`}>
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

/** Score as five rising bars (like Linear's priority icon), filled up to the score in its colour. */
export function ScoreBars({
  value,
  label,
  names,
}: {
  value: number | null;
  label: string;
  names?: Record<number, string>;
}) {
  const tone = value ? SCORE_TONE[value] : null;
  const title = value ? `${label} ${value}${names?.[value] ? `: ${names[value]}` : ""}` : `${label}: not set`;
  return (
    <span title={title} aria-label={title} role="img" className="inline-flex h-3.5 items-end gap-px">
      {ROADMAP_SCORES.map((n) => (
        <span
          key={n}
          className={`w-[3px] rounded-[1px] ${tone && value !== null && n <= value ? tone.fill : "bg-slate-200"}`}
          style={{ height: `${4 + (n - 1) * 2.5}px` }}
        />
      ))}
    </span>
  );
}

/** Impact and ease side by side as bar icons, for cards. */
export function ScoreBarsPair({
  impact,
  ease,
  impactNames,
  easeNames,
}: {
  impact: number | null;
  ease: number | null;
  impactNames?: Record<number, string>;
  easeNames?: Record<number, string>;
}) {
  if (impact === null && ease === null) return null;
  return (
    <span className="inline-flex items-end gap-1.5">
      <ScoreBars value={impact} label="Impact" names={impactNames} />
      <ScoreBars value={ease} label="Ease" names={easeNames} />
    </span>
  );
}

export function ScoreDropdown({
  value,
  names,
  onChange,
  label = "Score",
  compact,
}: {
  value: number | null;
  names: Record<number, string>;
  onChange: (value: number | null) => void;
  /** Impact or Ease: names the bars for hover and screen readers. */
  label?: string;
  /** In a right-hand table cell: open the menu leftwards. */
  compact?: { label: string };
}) {
  const name = compact?.label ?? label;
  return (
    <MetaDropdown
      bare
      alignRight={Boolean(compact)}
      display={
        <span className="inline-flex items-center px-1 py-1">
          <ScoreBars value={value} label={name} names={names} />
        </span>
      }
      options={[...ROADMAP_SCORES].reverse().map((n) => ({
        key: String(n),
        selected: value === n,
        onSelect: () => onChange(n),
        node: <ScoreChoice value={n} label={name} names={names} />,
      }))}
      onClear={value ? () => onChange(null) : undefined}
    />
  );
}

/** A score in a picker menu: its bars and its word, e.g. Big. */
export function ScoreChoice({ value, label, names }: { value: number; label: string; names: Record<number, string> }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ScoreBars value={value} label={label} names={names} />
      <span className="text-slate-700">{names[value]}</span>
    </span>
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


/** The Board / List / Graph style switch, for the roadmap tabs. */
export function ViewToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string; icon: React.ComponentType<{ className?: string }> }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-200">
      {options.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition ${
            value === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Icon className="h-3.5 w-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

/**
 * A job's status as a small circle that fills as it moves along (our own
 * drawing of the idea Linear uses): dotted to do, a quarter in progress, half
 * in review, three quarters ready, full on staging, a ring with a tick when live.
 */
const STATUS_ICON: Record<RoadmapStatus, { color: string; shape: "dotted" | "dashed" | "pie" | "full" | "tick" | "cross"; fill?: number }> = {
  evaluate: { color: "text-violet-500", shape: "dashed" },
  parked: { color: "text-slate-400", shape: "dashed" },
  vetoed: { color: "text-rose-500", shape: "cross" },
  todo: { color: "text-slate-400", shape: "dotted" },
  up_next: { color: "text-orange-500", shape: "dotted" },
  in_progress: { color: "text-blue-500", shape: "pie", fill: 0.25 },
  review: { color: "text-amber-500", shape: "pie", fill: 0.5 },
  done: { color: "text-emerald-500", shape: "pie", fill: 0.75 },
  staged: { color: "text-cyan-600", shape: "full" },
  live: { color: "text-green-700", shape: "tick" },
};

function pie(fill: number): string {
  // A slice from twelve o'clock, clockwise, inside the ring (centre 7,7; radius 3.5).
  const angle = fill * 2 * Math.PI;
  const x = 7 + 3.5 * Math.sin(angle);
  const y = 7 - 3.5 * Math.cos(angle);
  return `M7 7 L7 3.5 A3.5 3.5 0 ${fill > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

export function StatusIcon({ status, className = "h-3.5 w-3.5" }: { status: RoadmapStatus; className?: string }) {
  const { color, shape, fill = 0 } = STATUS_ICON[status];
  return (
    <svg viewBox="0 0 14 14" className={`shrink-0 ${color} ${className}`} aria-hidden fill="none">
      {shape === "dotted" ? <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.4 2.1" strokeLinecap="round" /> : null}
      {shape === "dashed" ? <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2.4" /> : null}
      {shape === "pie" || shape === "full" ? <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" /> : null}
      {shape === "pie" ? <path d={pie(fill)} fill="currentColor" /> : null}
      {shape === "full" ? <circle cx="7" cy="7" r="3.5" fill="currentColor" /> : null}
      {shape === "tick" ? (
        <>
          <circle cx="7" cy="7" r="7" fill="currentColor" />
          <path d="M4.2 7.2 6.1 9 9.8 5.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {shape === "cross" ? (
        <>
          <circle cx="7" cy="7" r="7" fill="currentColor" />
          <path d="M4.8 4.8 9.2 9.2M9.2 4.8 4.8 9.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
}

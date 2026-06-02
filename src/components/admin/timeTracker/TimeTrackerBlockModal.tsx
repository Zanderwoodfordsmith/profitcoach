"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import type {
  TimeBlockPriority,
  TimeBlockRating,
  TimeTrackerBlock,
} from "@/lib/timeTracker/types";
import { formatMinutes } from "@/lib/timeTracker/time";
import { TimeTrackerSelect } from "./TimeTrackerSelect";

const RATING_OPTIONS: {
  value: TimeBlockRating;
  label: string;
  active: string;
}[] = [
  { value: "good", label: "Good use", active: "bg-emerald-500 text-white ring-emerald-500" },
  { value: "bad", label: "Bad use", active: "bg-rose-500 text-white ring-rose-500" },
  {
    value: "neutral",
    label: "Neutral",
    active: "bg-amber-400 text-amber-950 ring-amber-400",
  },
  { value: "unset", label: "Not rated", active: "bg-slate-600 text-white ring-slate-600" },
];

const DEFAULT_CATEGORY_SUGGESTIONS = [
  "Deep work",
  "Coaching",
  "Sales / calls",
  "Admin",
  "Marketing",
  "Meetings",
  "Learning",
  "Personal",
  "Break",
];

const PRIORITY_OPTIONS: {
  value: TimeBlockPriority;
  label: string;
  active: string;
}[] = [
  { value: "high", label: "High", active: "bg-rose-500 text-white ring-rose-500" },
  {
    value: "medium",
    label: "Medium",
    active: "bg-amber-400 text-amber-950 ring-amber-400",
  },
  { value: "low", label: "Low", active: "bg-sky-500 text-white ring-sky-500" },
  { value: "none", label: "None", active: "bg-slate-600 text-white ring-slate-600" },
];

export type BlockDraft = {
  title: string;
  notes: string;
  rating: TimeBlockRating;
  priority: TimeBlockPriority;
  category: string;
  startMin: number;
  endMin: number;
};

type TimeTrackerBlockModalProps = {
  block: TimeTrackerBlock;
  dayLabel: string;
  readOnly: boolean;
  saving: boolean;
  deleting: boolean;
  /** Step (minutes) for the start/end time pickers. */
  slotMinutes: number;
  /** Titles from this admin's previous blocks, for picking recurring work. */
  titleSuggestions?: string[];
  /** Categories already used by this admin, surfaced as reusable suggestions. */
  categorySuggestions?: string[];
  onClose: () => void;
  onSave: (draft: BlockDraft) => void;
  onDelete: () => void;
};

export function TimeTrackerBlockModal({
  block,
  dayLabel,
  readOnly,
  saving,
  deleting,
  slotMinutes,
  titleSuggestions,
  categorySuggestions,
  onClose,
  onSave,
  onDelete,
}: TimeTrackerBlockModalProps) {
  const [title, setTitle] = useState(block.title);
  const [notes, setNotes] = useState(block.notes);
  const [rating, setRating] = useState<TimeBlockRating>(block.rating);
  const [priority, setPriority] = useState<TimeBlockPriority>(block.priority);
  const [category, setCategory] = useState(block.category);
  const [startMin, setStartMin] = useState(block.startMin);
  const [endMin, setEndMin] = useState(block.endMin);

  useEffect(() => {
    setTitle(block.title);
    setNotes(block.notes);
    setRating(block.rating);
    setPriority(block.priority);
    setCategory(block.category);
    setStartMin(block.startMin);
    setEndMin(block.endMin);
  }, [block]);

  const step = slotMinutes > 0 ? slotMinutes : 15;
  const startOptions = useMemo(() => {
    const opts: number[] = [];
    for (let m = 0; m < 1440; m += step) opts.push(m);
    if (!opts.includes(startMin)) opts.push(startMin);
    return opts.sort((a, b) => a - b);
  }, [step, startMin]);
  const endOptions = useMemo(() => {
    const opts: number[] = [];
    for (let m = step; m <= 1440; m += step) opts.push(m);
    if (!opts.includes(endMin)) opts.push(endMin);
    return opts.sort((a, b) => a - b);
  }, [step, endMin]);

  const timeInvalid = endMin <= startMin;

  function handleStartChange(value: number) {
    setStartMin(value);
    if (endMin <= value) setEndMin(Math.min(1440, value + step));
  }

  const dedupeList = (values: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of values) {
      const trimmed = c.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out;
  };
  const categoryOptions = useMemo(
    () => dedupeList([...(categorySuggestions ?? []), ...DEFAULT_CATEGORY_SUGGESTIONS]),
    [categorySuggestions]
  );
  const titleOptions = useMemo(
    () => dedupeList(titleSuggestions ?? []),
    [titleSuggestions]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const timeRange = useMemo(
    () => `${formatMinutes(startMin)} – ${formatMinutes(endMin)}`,
    [startMin, endMin]
  );
  const durationLabel = useMemo(() => {
    const mins = Math.max(0, endMin - startMin);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }, [startMin, endMin]);

  const busy = saving || deleting;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-block-title"
      onClick={onClose}
    >
      <div
        className="relative my-4 w-full max-w-2xl rounded-2xl bg-[#f8fbff] shadow-2xl ring-1 ring-slate-900/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {dayLabel}
            </p>
            {readOnly ? (
              <>
                <h2
                  id="time-block-title"
                  className="mt-0.5 text-lg font-semibold text-slate-900"
                >
                  {timeRange}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">{durationLabel}</p>
              </>
            ) : (
              <div id="time-block-title" className="mt-1 flex flex-wrap items-center gap-2">
                <TimeTrackerSelect
                  value={String(startMin)}
                  onChange={(v) => handleStartChange(Number(v))}
                  options={startOptions.map((m) => ({
                    value: String(m),
                    label: formatMinutes(m),
                  }))}
                  ariaLabel="Start time"
                  className="w-28"
                />
                <span className="text-sm text-slate-400">to</span>
                <TimeTrackerSelect
                  value={String(endMin)}
                  onChange={(v) => setEndMin(Number(v))}
                  options={endOptions.map((m) => ({
                    value: String(m),
                    label: formatMinutes(m),
                  }))}
                  ariaLabel="End time"
                  className="w-28"
                />
                <span className="text-xs font-medium text-slate-500">{durationLabel}</span>
              </div>
            )}
            {!readOnly && timeInvalid && (
              <p className="mt-1 text-[11px] text-rose-600">
                End time must be after the start time.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              What are you doing?
            </label>
            {readOnly ? (
              <p className="text-sm text-slate-900">
                {title || <span className="text-slate-400">Untitled block</span>}
              </p>
            ) : (
              <>
                <TimeTrackerSelect
                  value={title}
                  onChange={setTitle}
                  options={titleOptions.map((t) => ({ value: t, label: t }))}
                  freeSolo
                  placeholder="e.g. Client coaching call"
                  ariaLabel="Block title"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Pick a previous one to keep the same project, or type something new.
                </p>
              </>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Is this a good or bad use of your time?
            </label>
            <div className="flex flex-wrap gap-2">
              {RATING_OPTIONS.map((opt) => {
                const isActive = rating === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setRating(opt.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                      isActive
                        ? opt.active
                        : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                    } ${readOnly ? "cursor-default" : ""}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((opt) => {
                const isActive = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setPriority(opt.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                      isActive
                        ? opt.active
                        : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                    } ${readOnly ? "cursor-default" : ""}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </label>
            {readOnly ? (
              <p className="text-sm text-slate-900">
                {category || <span className="text-slate-400">—</span>}
              </p>
            ) : (
              <>
                <TimeTrackerSelect
                  value={category}
                  onChange={setCategory}
                  options={categoryOptions.map((c) => ({ value: c, label: c }))}
                  freeSolo
                  placeholder="Pick one or type your own…"
                  ariaLabel="Category"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Type a new category to create your own — it will be suggested next time.
                </p>
              </>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </label>
            {readOnly ? (
              <p className="whitespace-pre-wrap text-sm text-slate-900">
                {notes || <span className="text-slate-400">—</span>}
              </p>
            ) : (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Anything worth remembering about this block…"
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            )}
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-4">
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  onSave({ title, notes, rating, priority, category, startMin, endMin })
                }
                disabled={busy || timeInvalid}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

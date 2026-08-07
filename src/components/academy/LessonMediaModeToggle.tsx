"use client";

import { Headphones, MonitorPlay } from "lucide-react";

export type LessonMediaMode = "watch" | "listen";

type Props = {
  mode: LessonMediaMode;
  onModeChange: (mode: LessonMediaMode) => void;
  /** Compact pill for embedding in the video control bar. */
  compact?: boolean;
  className?: string;
};

/** Watch | Listen segment control for lesson media. */
export function LessonMediaModeToggle({
  mode,
  onModeChange,
  compact = false,
  className = "",
}: Props) {
  const base =
    compact
      ? "inline-flex shrink-0 items-center rounded-md bg-black/35 p-0.5 ring-1 ring-white/15"
      : "inline-flex items-center rounded-full bg-slate-900/80 p-1 ring-1 ring-white/10";

  const btn = (active: boolean) =>
    compact
      ? `inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
          active
            ? "bg-white text-slate-900"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        }`
      : `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          active
            ? "bg-white text-slate-900 shadow-sm"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`;

  return (
    <div
      className={`${base} ${className}`}
      role="group"
      aria-label="Lesson media mode"
    >
      <button
        type="button"
        aria-pressed={mode === "watch"}
        onClick={() => onModeChange("watch")}
        className={btn(mode === "watch")}
      >
        <MonitorPlay className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
        Watch
      </button>
      <button
        type="button"
        aria-pressed={mode === "listen"}
        onClick={() => onModeChange("listen")}
        className={btn(mode === "listen")}
      >
        <Headphones className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
        Listen
      </button>
    </div>
  );
}

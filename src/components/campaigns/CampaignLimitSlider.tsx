"use client";

import { useState, type ReactNode } from "react";

export function CampaignLimitSlider({
  label,
  ariaLabel,
  value,
  min = 1,
  max,
  warnAt,
  warning,
  onChange,
  onCommit,
}: {
  label: ReactNode;
  ariaLabel?: string;
  value: number;
  min?: number;
  max: number;
  warnAt?: number;
  warning?: string;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const clamped = Math.min(max, Math.max(min, value));
  const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0;
  const warn = warnAt != null && clamped >= warnAt;
  const warnPct =
    warnAt != null && max > min
      ? Math.max(0, ((max - warnAt) / (max - min)) * 100)
      : 0;
  const labelText =
    ariaLabel ?? (typeof label === "string" ? label : "Weekly limit");

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <input
          type="number"
          min={min}
          max={max}
          value={clamped}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            onChange(Math.min(max, Math.max(min, Math.round(next))));
          }}
          onBlur={() => onCommit(clamped)}
          className={`w-14 rounded-lg border bg-white px-1.5 py-1 text-right text-sm font-semibold tabular-nums outline-none focus-visible:ring-2 ${
            warn
              ? "border-rose-200 text-rose-700 focus-visible:ring-rose-200"
              : "border-slate-200 text-slate-900 focus-visible:ring-[#0c5290]/30"
          }`}
          aria-label={labelText}
        />
      </div>
      <div
        className={`relative h-3 rounded-full ${
          focused
            ? warn
              ? "ring-2 ring-rose-300 ring-offset-2"
              : "ring-2 ring-[#0c5290]/40 ring-offset-2"
            : ""
        }`}
      >
        <div className="absolute inset-0 overflow-hidden rounded-full bg-slate-100">
          {warnPct > 0 ? (
            <div
              className="absolute inset-y-0 right-0 bg-rose-100/90"
              style={{ width: `${warnPct}%` }}
              aria-hidden
            />
          ) : null}
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-150 ${
              warn ? "bg-rose-500" : "bg-[#0c5290]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {warnAt != null && max > min ? (
          <div
            className="pointer-events-none absolute top-1/2 z-[11] h-3.5 w-px -translate-x-1/2 -translate-y-1/2 bg-rose-300"
            style={{
              left: `${((warnAt - min) / (max - min)) * 100}%`,
            }}
            aria-hidden
          />
        ) : null}
        <div
          className={`pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ${
            warn ? "bg-rose-500" : "bg-[#0c5290]"
          }`}
          style={{ left: `${pct}%` }}
          aria-hidden
        />
        <input
          type="range"
          min={min}
          max={max}
          value={clamped}
          onChange={(e) => onChange(Number(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onCommit(clamped);
          }}
          onMouseUp={(e) =>
            onCommit(Number((e.currentTarget as HTMLInputElement).value))
          }
          onTouchEnd={(e) =>
            onCommit(Number((e.currentTarget as HTMLInputElement).value))
          }
          onKeyUp={(e) =>
            onCommit(Number((e.currentTarget as HTMLInputElement).value))
          }
          className="absolute inset-0 z-20 h-full w-full cursor-pointer appearance-none opacity-0"
        />
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-slate-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {warn && warning ? (
        <p className="text-[12px] leading-snug text-rose-700">{warning}</p>
      ) : null}
    </div>
  );
}

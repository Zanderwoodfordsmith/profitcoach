"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string };

type TimeTrackerSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Allow typing a value that isn't in the list (combobox behaviour). */
  freeSolo?: boolean;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  /** When true, the panel matches the trigger width; otherwise it sizes to content. */
  fullWidthPanel?: boolean;
};

export function TimeTrackerSelect({
  value,
  onChange,
  options,
  freeSolo = false,
  placeholder,
  disabled = false,
  ariaLabel,
  className = "",
  fullWidthPanel = true,
}: TimeTrackerSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(() => {
    const match = options.find((o) => o.value === value);
    return match?.label ?? value;
  }, [options, value]);

  // For the combobox, the input shows the live value; filtering uses the query.
  const filtered = useMemo(() => {
    const q = (freeSolo ? value : query).trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, value, freeSolo]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const el = rootRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && !freeSolo) {
      const t = window.setTimeout(() => setQuery(""), 0);
      return () => window.clearTimeout(t);
    }
  }, [open, freeSolo]);

  function selectValue(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  const panelClasses = `absolute left-0 z-[260] mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5 ${
    fullWidthPanel ? "w-full" : "min-w-full"
  }`;

  const triggerClasses =
    "flex w-full items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-50";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {freeSolo ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            aria-label={ariaLabel}
            aria-expanded={open}
            role="combobox"
            aria-controls="tt-select-panel"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setOpen((v) => !v);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 hover:text-slate-600"
            aria-label="Toggle suggestions"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={triggerClasses}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
        >
          <span className="min-w-0 flex-1 truncate">
            {selectedLabel || (
              <span className="text-slate-400">{placeholder ?? "Select…"}</span>
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      )}

      {open && (
        <div id="tt-select-panel" className={panelClasses} role="listbox">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">
              {freeSolo ? "Keep typing to add a new one…" : "No options."}
            </p>
          ) : (
            <ul className="px-1">
              {filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => selectValue(opt.value)}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                        active
                          ? "bg-sky-50 font-medium text-sky-900"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0 text-sky-600" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

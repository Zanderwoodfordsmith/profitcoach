"use client";

import { Columns3, List } from "lucide-react";

export type ProspectsView = "board" | "list";

type Props = {
  view: ProspectsView;
  onChange: (view: ProspectsView) => void;
};

export function ProspectsViewSwitcher({ view, onChange }: Props) {
  return (
    <div
      className="inline-flex h-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
      role="group"
      aria-label="Prospects view"
    >
      <button
        type="button"
        aria-label="Pipeline view"
        aria-pressed={view === "board"}
        onClick={() => onChange("board")}
        className={`flex items-center justify-center px-3 transition ${
          view === "board"
            ? "bg-sky-600 text-white"
            : "bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Columns3 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>
      <span
        className="w-px shrink-0 self-stretch bg-slate-200"
        aria-hidden
      />
      <button
        type="button"
        aria-label="List view"
        aria-pressed={view === "list"}
        onClick={() => onChange("list")}
        className={`flex items-center justify-center px-3 transition ${
          view === "list"
            ? "bg-sky-600 text-white"
            : "bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <List className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

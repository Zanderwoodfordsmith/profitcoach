"use client";

import { CalendarDays, List } from "lucide-react";

export type CallsWorkspaceView = "calendar" | "list";

type Props = {
  view: CallsWorkspaceView;
  onChange: (view: CallsWorkspaceView) => void;
};

export function CallsViewSwitcher({ view, onChange }: Props) {
  return (
    <div
      className="inline-flex h-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
      role="group"
      aria-label="Calls view"
    >
      <button
        type="button"
        aria-label="Calendar view"
        aria-pressed={view === "calendar"}
        onClick={() => onChange("calendar")}
        className={`flex items-center justify-center px-3 transition ${
          view === "calendar"
            ? "bg-sky-600 text-white"
            : "bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <CalendarDays className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>
      <span className="w-px shrink-0 self-stretch bg-slate-200" aria-hidden />
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

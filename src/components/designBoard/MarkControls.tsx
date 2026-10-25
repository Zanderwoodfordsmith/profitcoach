"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import type { Mark } from "./types";

export type Save = (id: string, kind: string, label: string, next: Mark) => void;

/** Fits / Doesn't fit plus a note. Click a pressed mark again to clear it. */
export function MarkControls({
  id,
  kind,
  label,
  mark,
  save,
  yes = "Fits",
  no = "Doesn't fit",
}: {
  id: string;
  kind: string;
  label: string;
  mark?: Mark;
  save: Save;
  yes?: string;
  no?: string;
}) {
  const current = mark ?? { mark: null, note: "" };
  const [note, setNote] = useState(current.note);

  const choose = (m: "fits" | "no") => save(id, kind, label, { ...current, mark: current.mark === m ? null : m });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => choose("fits")}
          aria-pressed={current.mark === "fits"}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition ${
            current.mark === "fits"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
          }`}
        >
          <Check className="h-4 w-4" /> {yes}
        </button>
        <button
          type="button"
          onClick={() => choose("no")}
          aria-pressed={current.mark === "no"}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition ${
            current.mark === "no"
              ? "border-rose-600 bg-rose-600 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-rose-300"
          }`}
        >
          <X className="h-4 w-4" /> {no}
        </button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note.trim() !== current.note && save(id, kind, label, { ...current, note: note.trim() })}
        rows={1}
        placeholder="A note (optional)"
        className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#0c5290] focus:outline-none"
      />
    </div>
  );
}

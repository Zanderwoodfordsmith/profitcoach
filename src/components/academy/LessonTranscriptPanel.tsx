"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  transcriptText: string;
};

export function LessonTranscriptPanel({ transcriptText }: Props) {
  const [open, setOpen] = useState(false);
  const trimmed = transcriptText.trim();
  const lineCount = useMemo(
    () => (trimmed ? trimmed.split(/\r?\n/).length : 0),
    [trimmed]
  );

  if (!trimmed) return null;

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-900">Transcript</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {open ? "Hide" : "Show"}
          {lineCount > 0 ? ` · ${lineCount} lines` : null}
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>
      {open ? (
        <div className="max-h-96 overflow-y-auto border-t border-slate-200 px-4 py-3">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
            {trimmed}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

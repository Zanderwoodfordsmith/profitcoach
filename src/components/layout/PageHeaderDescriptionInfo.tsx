"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Info } from "lucide-react";

export function PageHeaderDescriptionInfo({
  children,
}: {
  children: ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-m-1 rounded-full p-1 text-slate-400 outline-none ring-sky-500/50 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 aria-expanded:bg-slate-100 aria-expanded:text-slate-700"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Page description"
      >
        <Info className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-2 w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base leading-relaxed text-slate-700 shadow-lg"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

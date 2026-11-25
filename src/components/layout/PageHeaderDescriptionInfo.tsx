"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import type { SectionGuide } from "./sectionGuides";
import { startSectionTour } from "./SectionTour";

export function PageHeaderDescriptionInfo({
  children,
  pitch,
  title,
}: {
  children?: ReactNode;
  /** Areas with a guide: the icon starts it instead. */
  pitch?: SectionGuide | null;
  title?: string;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || pitch) return;
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
  }, [open, pitch]);

  const hasPage = children != null && children !== "";

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => (pitch ? startSectionTour(pitch.key) : setOpen((v) => !v))}
        data-section-guide-anchor={pitch ? title : undefined}
        className="-m-1 rounded-full p-1 text-slate-400 outline-none ring-sky-500/50 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 aria-expanded:bg-slate-100 aria-expanded:text-slate-700"
        aria-expanded={pitch ? undefined : open}
        aria-controls={open && !pitch ? panelId : undefined}
        aria-label={pitch ? `What ${title} is for` : "What this page is for"}
      >
        <Info className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>
      {!pitch && open && hasPage ? (
        // Opens from the icon's left edge, so it never runs under the sidebar.
        <div
          id={panelId}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-3 w-[min(calc(100vw-2rem),24rem)] rounded-lg border border-slate-200 bg-white p-4 text-left text-sm leading-relaxed text-slate-700 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)]"
        >
          <span
            aria-hidden
            className="absolute -top-[6px] left-[5px] h-2.5 w-2.5 rotate-45 border-l border-t border-slate-200 bg-white"
          />
          {children}
        </div>
      ) : null}
    </div>
  );
}

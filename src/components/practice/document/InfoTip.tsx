"use client";

import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

/** A small "i" that explains what something is. Opens on hover, focus or tap. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="bp-no-print relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Out of the Tab order: Tab goes from answer to answer. Hover or tap opens it. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--bp-faint)] transition-colors hover:text-[var(--bp-blue)] focus-visible:text-[var(--bp-blue)]"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[80vw] space-y-1.5 rounded-xl bg-[var(--bp-navy)] px-3.5 py-2.5 text-left text-[0.8125rem] font-normal normal-case leading-5 tracking-normal text-white shadow-[0_14px_30px_-12px_rgba(5,30,54,0.6)]"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

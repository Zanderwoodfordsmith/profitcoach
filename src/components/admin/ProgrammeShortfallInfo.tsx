"use client";

import { Info } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  explanation: string;
};

export function ProgrammeShortfallInfo({ explanation }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );

  const place = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 24);
    let left = rect.left;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    let top = rect.bottom + 8;
    if (top + 120 > window.innerHeight - 12) {
      top = Math.max(12, rect.top - 120);
    }
    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const scrollOpts = { capture: true } as const;
    window.addEventListener("scroll", place, scrollOpts);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, scrollOpts);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-yellow-950 hover:bg-yellow-400"
        aria-label="Programme payment shortfall"
        aria-describedby={open ? panelId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <Info className="h-3 w-3" aria-hidden />
      </button>
      {open && position
        ? createPortal(
            <div
              id={panelId}
              role="tooltip"
              className="fixed z-[220] w-72 rounded-lg border border-yellow-200 bg-white px-3 py-2.5 text-left text-xs leading-relaxed text-slate-700 shadow-lg"
              style={{ left: position.left, top: position.top }}
            >
              {explanation}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

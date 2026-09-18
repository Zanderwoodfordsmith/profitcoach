"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type { ReplyDisposition } from "@/lib/prospects/replyDisposition";

const OPTIONS: Array<{
  value: ReplyDisposition;
  label: string;
  hint: string;
  chip: string;
}> = [
  {
    value: "interested",
    label: "Interested",
    hint: "Keen now — pause the sequence and follow up.",
    chip: "border-emerald-400 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
  },
  {
    value: "neutral",
    label: "Neutral",
    hint: "Maybe later / interest in the future.",
    chip: "border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100",
  },
  {
    value: "not_interested",
    label: "Not interested",
    hint: "Stop outreach to this person.",
    chip: "border-rose-400 bg-rose-50 text-rose-950 hover:bg-rose-100",
  },
];

const UNSET_CHIP = "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100";

function chipClass(
  compact: boolean | undefined,
  extra: string,
  withChevron = false
) {
  const pad = withChevron
    ? compact
      ? "gap-0.5 py-0.5 pl-2 pr-1.5 text-xs"
      : "gap-1 py-1 pl-2.5 pr-1.5 text-xs"
    : compact
      ? "px-2 py-0.5 text-xs"
      : "px-2.5 py-1 text-xs";
  return `inline-flex shrink-0 items-center rounded-full border font-semibold ${pad} ${extra}`;
}

export function ReplyDispositionBar({
  value,
  onChange,
  busy,
  compact,
}: {
  value: ReplyDisposition | null;
  onChange: (next: ReplyDisposition) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = OPTIONS.find((option) => option.value === value) ?? null;

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!rect) return;
      const menuWidth = menu?.offsetWidth || 168;
      const menuHeight = menu?.offsetHeight || 120;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8
      );
      const below = rect.bottom + 6;
      const top =
        below + menuHeight > window.innerHeight - 8
          ? Math.max(8, rect.top - menuHeight - 6)
          : below;
      setPosition({ top, left });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selected = OPTIONS.findIndex((option) => option.value === value);
    setActiveIndex(selected >= 0 ? selected : 0);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => {
          const delta = event.key === "ArrowDown" ? 1 : -1;
          return (index + delta + OPTIONS.length) % OPTIONS.length;
        });
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="listbox"
            aria-label="This person's interest"
            className="fixed z-[260] w-max rounded-xl border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
          >
            <div className="flex flex-col items-start gap-1.5">
              {OPTIONS.map((option, index) => {
                const selected = value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    title={option.hint}
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      buttonRef.current?.focus();
                    }}
                    className={`${chipClass(compact, option.chip)} ${
                      selected ? "ring-1 ring-current/25" : ""
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="This person's interest"
        title={current?.hint ?? "How this person is responding"}
        disabled={busy}
        onClick={() => setOpen((next) => !next)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            setActiveIndex((index) => {
              const delta = event.key === "ArrowDown" ? 1 : -1;
              return (index + delta + OPTIONS.length) % OPTIONS.length;
            });
            return;
          }
          if (open && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            const next = OPTIONS[activeIndex];
            if (next) onChange(next.value);
            setOpen(false);
          }
        }}
        className={`${chipClass(
          compact,
          current ? current.chip : UNSET_CHIP,
          true
        )} outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-wait disabled:opacity-50`}
      >
        {current ? current.label : "Interest level"}
        <ChevronDown
          className={`shrink-0 opacity-70 ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  );
}

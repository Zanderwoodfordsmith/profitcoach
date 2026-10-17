"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import type { SectionWorkflow } from "@/lib/practiceKnowledge/sectionWorkflow";

import { STATUS_LOOK } from "./statusLook";

const STATUS_OPTIONS: { id: SectionWorkflow["status"]; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

/** The section's status as one pill. Click it to change. */
export function StatusSwitch({
  label,
  status,
  onChange,
  size = "md",
}: {
  /** sm: the smaller pill used on the LinkedIn profile parts. */
  size?: "sm" | "md";
  label: string;
  status: SectionWorkflow["status"];
  onChange: (status: SectionWorkflow["status"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = STATUS_LOOK[status];
  const currentLabel = STATUS_OPTIONS.find((o) => o.id === status)?.label ?? "To do";
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} status: ${currentLabel}. Change status`}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`inline-flex items-center rounded-full font-semibold ring-1 ring-inset ${
          size === "sm" ? "gap-1 py-0.5 pl-2 pr-1.5 text-[11px]" : "gap-1.5 py-1 pl-2.5 pr-2 text-xs shadow-[0_1px_2px_rgba(5,30,54,0.25)]"
        } ${current.pill}`}
      >
        <current.Icon className="h-3.5 w-3.5" strokeWidth={current.stroke} aria-hidden />
        <span className="whitespace-nowrap">{currentLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="bp-pop absolute right-0 top-full z-20 mt-1.5 w-40 rounded-xl border border-[#e3e8ef] bg-white p-1 shadow-lg">
          {STATUS_OPTIONS.map((option) => {
            const look = STATUS_LOOK[option.id];
            const selected = option.id === status;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onChange(option.id);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium hover:bg-[var(--bp-tint)] ${look.option}`}
              >
                <look.Icon className="h-3.5 w-3.5" strokeWidth={look.stroke} aria-hidden />
                <span className="flex-1">{option.label}</span>
                {selected ? <Check className="h-3.5 w-3.5 text-[var(--bp-ink)]" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}


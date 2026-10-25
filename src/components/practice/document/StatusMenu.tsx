"use client";

import { useState } from "react";
import { Check, ChevronDown, Circle } from "lucide-react";

import type { SectionWorkflow, WorkflowOwner } from "@/lib/practiceKnowledge/sectionWorkflow";

import { STATUS_LOOK } from "./statusLook";

const STATUS_OPTIONS: { id: SectionWorkflow["status"]; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

/** To do or Review while it waits on BCA: the overview's quiet blue, not the colours that ask the coach to act. */
const BCA_LOOK = { pill: "bg-sky-100 text-[#0c5290] ring-sky-200", option: "text-[#0c5290]", Icon: Circle, stroke: 2 };

/** The section's status as one pill. Click it to change. */
export function StatusSwitch({
  label,
  status,
  onChange,
  size = "md",
  todoOwner,
  bcaReview,
}: {
  /** sm: the smaller pill used on the LinkedIn profile parts. */
  size?: "sm" | "md";
  label: string;
  status: SectionWorkflow["status"];
  onChange: (status: SectionWorkflow["status"]) => void;
  /** Who To do waits on. Names it like the overview does: Needs you, or BCA to do. */
  todoOwner?: WorkflowOwner;
  /** Signed off by the coach and waiting on BCA's check. Plain Review always means the coach. */
  bcaReview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const lookFor = (id: SectionWorkflow["status"]) => (id === "todo" && todoOwner === "bca" ? BCA_LOOK : STATUS_LOOK[id]);
  const labelFor = (id: SectionWorkflow["status"]) =>
    id === "todo" && todoOwner
      ? todoOwner === "bca"
        ? "BCA to do"
        : "Needs you"
      : (STATUS_OPTIONS.find((o) => o.id === id)?.label ?? "To do");
  const waitingOnBca = bcaReview && status === "review";
  const current = waitingOnBca ? BCA_LOOK : lookFor(status);
  const currentLabel = waitingOnBca ? "BCA review" : labelFor(status);
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
          size === "sm" ? "gap-1 py-0.5 pl-2 pr-1.5 text-caption" : "gap-1.5 py-1 pl-2.5 pr-2 text-xs shadow-[0_1px_2px_rgba(5,30,54,0.25)]"
        } ${current.pill}`}
      >
        <current.Icon className="h-3.5 w-3.5" strokeWidth={current.stroke} aria-hidden />
        <span className="whitespace-nowrap">{currentLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="bp-pop absolute right-0 top-full z-20 mt-1.5 w-40 rounded-xl border border-[#e3e8ef] bg-white p-1 shadow-lg">
          {STATUS_OPTIONS.map((option) => {
            const look = lookFor(option.id);
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
                <span className="flex-1">{labelFor(option.id)}</span>
                {selected ? <Check className="h-3.5 w-3.5 text-[var(--bp-ink)]" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}


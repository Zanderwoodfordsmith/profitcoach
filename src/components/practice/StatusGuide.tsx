"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { badgeClass, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { PAGE_STATUS_COPY, PAGE_STATUS_ORDER, type PageStatusId } from "@/lib/practiceKnowledge/pageStatus";

export const PAGE_STATUS_TONE: Record<PageStatusId, BadgeTone> = {
  needs_you: "red",
  bca: "blue",
  review: "amber",
  done: "green",
};

const PAGE_STATUS_DOT: Record<PageStatusId, string> = {
  needs_you: "bg-[#e8a3a0]",
  bca: "bg-[#7eadd4]",
  review: "bg-[#e8c56a]",
  done: "bg-[#5ec9a0]",
};

export function PageStatusPill({ status }: { status: PageStatusId }) {
  const copy = PAGE_STATUS_COPY[status];
  return (
    <span
      title={copy.title}
      className={badgeClass(PAGE_STATUS_TONE[status])}
    >
      {copy.label}
    </span>
  );
}

/** Opens the four-status explainer from the blueprint overview. */
export function StatusGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("second", "small")}
      >
        <span className="flex items-center gap-1" aria-hidden>
          {PAGE_STATUS_ORDER.map((id) => (
            <span key={id} className={`h-2 w-2 rounded-full ${PAGE_STATUS_DOT[id]}`} />
          ))}
        </span>
        How status works
      </button>
      {open ? <StatusGuideModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function StatusGuideModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const leadId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function focusable() {
      if (!dialogRef.current) return [];
      return [...dialogRef.current.querySelectorAll<HTMLButtonElement>("button")].filter((el) => !el.disabled);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return createPortal(
    <div
      className="bp-no-print fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[#051e36]/45 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={leadId}
        onClick={(event) => event.stopPropagation()}
        className="bp-doc bp-status-guide-dialog relative flex max-h-[min(92vh,40rem)] w-full max-w-[28.5rem] flex-col overflow-hidden rounded-t-[1.5rem] bg-white shadow-[0_28px_64px_-24px_rgba(5,30,54,0.55),0_2px_8px_rgba(5,30,54,0.08)] sm:rounded-[1.5rem]"
      >
        <div className="h-1 w-full bg-[var(--bp-gradient)]" aria-hidden />
        <div className="flex items-start justify-between gap-4 px-6 pb-1 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-title font-semibold text-[var(--bp-ink)]">
              How status works
            </h2>
            <p id={leadId} className="mt-1.5 max-w-[36ch] text-sm leading-6 text-[var(--bp-muted)]">
              Each page has one of these. It tells you whose turn it is.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-0.5 rounded-full p-1.5 text-[var(--bp-faint)] transition-colors hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8fd4]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <ol className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {PAGE_STATUS_ORDER.map((id, index) => {
            const copy = PAGE_STATUS_COPY[id];
            const last = index === PAGE_STATUS_ORDER.length - 1;
            return (
              <li key={id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3">
                <span className="relative flex flex-col items-center">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${PAGE_STATUS_DOT[id]}`} aria-hidden />
                  {last ? null : <span className="mt-1 w-px flex-1 bg-[#e3eef8]" aria-hidden />}
                </span>
                <div className={last ? "pb-0.5" : "pb-6"}>
                  <PageStatusPill status={id} />
                  <p className="mt-1.5 text-sm leading-6 text-[var(--bp-body)]">{copy.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="border-t border-[var(--bp-rule)] bg-[#f7fbfe] px-6 py-4 text-sm leading-6 text-[var(--bp-muted)]">
          Start with the red pages. The blue ones come back to you when they are ready.
        </p>
      </div>
    </div>,
    document.body
  );
}

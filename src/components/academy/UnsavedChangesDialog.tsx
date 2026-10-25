"use client";

import { createPortal } from "react-dom";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

type Props = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
};

/** Confirm before discarding an in-progress lesson edit. */
export function UnsavedChangesDialog({ open, onStay, onLeave }: Props) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-lesson-changes-title"
      onClick={onStay}
    >
      <div
        className={cardClass("raised", "w-full max-w-sm p-5")}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Unsaved changes
        </p>
        <h2
          id="unsaved-lesson-changes-title"
          className="mt-2 text-base font-semibold text-slate-900"
        >
          Leave without saving?
        </h2>
        <p className="mt-2 text-ui text-slate-600">
          You&apos;ve made changes that haven&apos;t been saved yet. Stay to keep
          editing (and hit Save), or leave and discard them.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onStay}
            className={buttonClass("second")}
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            className={buttonClass("delete")}
          >
            Leave without saving
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

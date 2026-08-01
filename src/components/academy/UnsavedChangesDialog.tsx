"use client";

import { createPortal } from "react-dom";

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
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
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
        <p className="mt-2 text-[15px] leading-snug text-slate-600">
          You&apos;ve made changes that haven&apos;t been saved yet. Stay to keep
          editing (and hit Save), or leave and discard them.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onStay}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Leave without saving
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

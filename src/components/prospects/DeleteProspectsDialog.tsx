"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  rows: Array<{ id: string; full_name: string; email?: string | null }>;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteProspectsDialog({
  rows,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const single = rows.length === 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prospect-delete-dialog-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="prospect-delete-dialog-title"
          className="text-lg font-semibold text-slate-900"
        >
          Delete prospect{single ? "" : "s"}?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {single ? (
            <>
              Delete <span className="font-medium">{rows[0].full_name}</span>?
              This cannot be undone.
            </>
          ) : (
            <>Delete {rows.length} selected prospects? This cannot be undone.</>
          )}
        </p>
        {!single ? (
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-slate-500">
            {rows.map((row) => (
              <li key={row.id}>
                {row.full_name}
                {row.email ? ` · ${row.email}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

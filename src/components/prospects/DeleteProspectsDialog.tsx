"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const single = rows.length === 1;

  if (!mounted) return null;

  // The prospect details column sets view-transition-name and overflow:hidden.
  // That traps position:fixed inside the column and clips the confirm button,
  // so the page greys out with no way to finish the delete.
  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prospect-delete-dialog-title"
        className={cardClass("raised", "w-full max-w-md p-5")}
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
            className={buttonClass("quiet")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={buttonClass("delete")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

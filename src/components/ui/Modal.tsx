"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** When true, Escape and backdrop click do not close. */
  busy?: boolean;
  title: string;
  titleId?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  /** Backdrop color; default matches most app modals. */
  backdropClassName?: string;
  /** Extra classes on the fixed overlay (e.g. z-[80]). */
  overlayClassName?: string;
};

export function Modal({
  open,
  onClose,
  busy = false,
  title,
  titleId = "app-modal-title",
  subtitle,
  children,
  footer,
  maxWidthClassName = "max-w-md",
  backdropClassName = "bg-slate-900/40",
  overlayClassName = "z-50",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 ${overlayClassName} ${backdropClassName}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClassName} rounded-xl border border-slate-200 bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-slate-900"
            >
              {title}
            </h2>
            {subtitle ? (
              <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}

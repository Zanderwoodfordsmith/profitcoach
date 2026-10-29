"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./glassModal.css";

/**
 * Glass: centre over the page content and blur only that, so the sidebar,
 * title bar and a docked AI panel stay sharp (same as the search overlay).
 * The overlay needs the glass-modal class.
 */
export function useGlassPlacement(overlayRef: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!active || !overlay) return;
    const place = () => {
      const main = document.querySelector("main")?.getBoundingClientRect();
      const header = document.querySelector("main [data-page-header]")?.getBoundingClientRect();
      overlay.style.setProperty("--glass-inset-left", `${main ? Math.max(0, main.left) : 0}px`);
      overlay.style.setProperty(
        "--glass-inset-right",
        `${main ? Math.max(0, window.innerWidth - main.right) : 0}px`
      );
      overlay.style.setProperty("--glass-inset-top", `${header ? Math.max(0, header.bottom) : 0}px`);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [overlayRef, active]);
}

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
  /** The search overlay's glass look: navy dim, blurred page content, see-through panel. */
  glass?: boolean;
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
  glass = false,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useGlassPlacement(overlayRef, open && glass);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const dialog = (
    <div
      ref={overlayRef}
      className={`fixed inset-0 flex items-center justify-center p-4 ${overlayClassName} ${
        glass ? "glass-modal" : backdropClassName
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      {glass ? <div className="glass-modal-scrim" aria-hidden /> : null}
      <div
        className={`w-full ${maxWidthClassName} ${
          glass
            ? "glass-modal-panel rounded-[28px]"
            : "rounded-xl border border-slate-200 bg-white shadow-xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-start justify-between ${
            glass ? "gap-4 px-10 pb-2 pt-9" : "border-b border-slate-100 px-5 py-4"
          }`}
        >
          <div>
            <h2
              id={titleId}
              className={`font-semibold text-slate-900 ${glass ? "text-[22px] tracking-tight" : "text-lg"}`}
            >
              {title}
            </h2>
            {subtitle ? (
              <div className={glass ? "mt-1.5 text-base text-slate-600" : "mt-0.5 text-sm text-slate-500"}>
                {subtitle}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`rounded-lg p-1.5 disabled:opacity-50 ${
              glass
                ? "-mr-2 -mt-1 text-slate-500 hover:bg-white/60 hover:text-slate-900"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
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

  // Glass renders on the body so a sticky or blurred parent can't trap it under the page.
  return glass ? createPortal(dialog, document.body) : dialog;
}

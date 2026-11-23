"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ban, Check, Sparkles, X } from "lucide-react";
import { badgeClass } from "@/components/ui/Badge";
import { FIT_OPTIONS, fitOption, type FitLabel } from "@/lib/pool/fit";

/** What a person picks in a Fit menu (job 278). */
export type FitPick = FitLabel | "clear" | "blacklist" | "check";

/** Good, OK or Bad as a small pill; Blacklist in grey. Nothing until someone has checked them. */
export function FitBadge({ fit, blacklisted = false }: { fit: FitLabel | null | undefined; blacklisted?: boolean }) {
  if (blacklisted) return <span className={badgeClass("grey")}>Blacklist</span>;
  if (!fit) return <span className="text-slate-300">—</span>;
  const option = fitOption(fit);
  return <span className={badgeClass(option.tone)}>{option.short}</span>;
}

/** The choices, shared by a row's menu and the selection bar's menu. */
export function FitMenuItems({
  current,
  canCheck,
  canClear = Boolean(current),
  checkLabel = "Ask Ava to check",
  onPick,
}: {
  current?: FitLabel | null;
  canCheck: boolean;
  canClear?: boolean;
  checkLabel?: string;
  onPick: (pick: FitPick) => void;
}) {
  const item = "flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50";
  return (
    <>
      {FIT_OPTIONS.map((option) => (
        <button key={option.key} type="button" className={item} onClick={() => onPick(option.key)}>
          <span className={badgeClass(option.tone, "mt-0.5 w-11 justify-center")}>{option.short}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-slate-900">{option.label}</span>
            <span className="block text-xs text-slate-500">{option.hint}</span>
          </span>
          {current === option.key ? <Check className="mt-1 h-4 w-4 shrink-0 text-sky-600" aria-hidden /> : null}
        </button>
      ))}
      <button type="button" className={item} onClick={() => onPick("blacklist")}>
        <span className={badgeClass("grey", "mt-0.5 w-11 justify-center")}>
          <Ban className="h-3 w-3" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-slate-900">Blacklist</span>
          <span className="block text-xs text-slate-500">Never message, on any list. Moves them to your Blacklist.</span>
        </span>
      </button>
      <div className="my-1 border-t border-slate-100" />
      {canCheck ? (
        <button type="button" className={item} onClick={() => onPick("check")}>
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
          <span className="font-medium text-slate-900">{checkLabel}</span>
        </button>
      ) : null}
      {canClear ? (
        <button type="button" className={item} onClick={() => onPick("clear")}>
          <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="font-medium text-slate-700">Clear fit</span>
        </button>
      ) : null}
    </>
  );
}

const PANEL_WIDTH = 288;
const MARGIN = 8;

/** A row's Fit cell: the pill, and a menu to change it. The menu sits above the table so it isn't cut off. */
export function PoolFitCell({
  fit,
  why,
  by,
  blacklisted,
  disabled,
  onPick,
}: {
  fit: FitLabel | null | undefined;
  why: string | null | undefined;
  by: "ava" | "person" | null | undefined;
  blacklisted: boolean;
  disabled: boolean;
  onPick: (pick: FitPick) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = panelRef.current?.offsetHeight || 320;
      const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - MARGIN));
      const below = rect.bottom + 6;
      const top = below + height > window.innerHeight - MARGIN ? Math.max(MARGIN, rect.top - height - 6) : below;
      setPosition({ left, top });
    }
    place();
    const frame = window.requestAnimationFrame(place);
    window.addEventListener("scroll", place, { capture: true });
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function away(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const t = window.setTimeout(() => document.addEventListener("click", away, true), 0);
    document.addEventListener("keydown", esc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", away, true);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const reason = blacklisted
    ? "On your Blacklist: never messaged."
    : by === "person"
      ? "Set by you or BCA."
      : fit && why
        ? `Ava: ${why}`
        : fit
          ? "Ava's call."
          : "Not checked yet.";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        title={`${reason} Click to change.`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          // Hidden until it's placed beside the pill.
          if (!open) setPosition(null);
          setOpen((v) => !v);
        }}
        className="inline-flex min-h-6 items-center rounded-full hover:ring-2 hover:ring-slate-200 disabled:opacity-50"
      >
        <FitBadge fit={fit} blacklisted={blacklisted} />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              className="fixed z-[220] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
              style={{ left: position?.left ?? 0, top: position?.top ?? 0, width: PANEL_WIDTH, visibility: position ? "visible" : "hidden" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="px-3 pb-1.5 pt-1 text-xs text-slate-500">{reason}</p>
              <FitMenuItems
                current={fit}
                canCheck={!blacklisted && by !== "person"}
                checkLabel={fit ? "Ask Ava to check again" : "Ask Ava to check"}
                onPick={(pick) => {
                  setOpen(false);
                  onPick(pick);
                }}
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/** Selection bar: one button that opens the same choices for everyone ticked. */
export function FitSelectionMenu({
  count,
  disabled,
  open,
  onOpenChange,
  onPick,
  button,
}: {
  count: number;
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (pick: FitPick) => void;
  button: ReactNode;
}) {
  return (
    <div className="relative" data-pool-fit-menu="">
      {button}
      {open && !disabled ? (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <p className="px-3 py-1.5 text-kicker font-medium uppercase text-slate-400">
            Fit for {count.toLocaleString()} {count === 1 ? "person" : "people"}
          </p>
          <FitMenuItems
            canCheck
            canClear
            checkLabel={count > 200 ? "Ask Ava to check (first 200)" : "Ask Ava to check"}
            onPick={(pick) => {
              onOpenChange(false);
              onPick(pick);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  formatPaymentDate,
  formatPaymentMoney,
} from "@/lib/adminPaymentDisplay";
import type { CoachPaymentSummary } from "@/lib/admin/coachPaymentSummary";
import { formatCoachPaymentsCellLine } from "@/lib/admin/coachPaymentSummary";
import {
  paymentBillingKindBadgeClass,
  paymentBillingKindLabel,
} from "@/lib/paymentBillingKind";

const POPOVER_WIDTH_PX = 320;
const POPOVER_MAX_HEIGHT = 220;
const POPOVER_CLOSE_MS = 120;

type Props = {
  coachId: string;
  coachName: string;
  summary: CoachPaymentSummary;
  children: ReactNode;
};

export function CoachPaymentsPopover({
  coachId,
  coachName,
  summary,
  children,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (summary.succeeded_count === 0) return;
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer, summary.succeeded_count]);

  const hide = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer]);

  const scheduleHide = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, POPOVER_CLOSE_MS);
  }, [clearCloseTimer]);

  const toggle = useCallback(() => {
    if (summary.succeeded_count === 0) return;
    setOpen((prev) => {
      if (prev) {
        clearCloseTimer();
        return false;
      }
      clearCloseTimer();
      return true;
    });
  }, [clearCloseTimer, summary.succeeded_count]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const panelWidth = Math.min(POPOVER_WIDTH_PX, window.innerWidth - 24);
      let left = rect.left + rect.width / 2 - panelWidth / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));

      const estimatedHeight = Math.min(
        POPOVER_MAX_HEIGHT + 88,
        88 + summary.recent_payments.length * 28
      );
      let top = rect.bottom + 8;
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - estimatedHeight - 8);
      }

      setPosition({ left, top });
    }

    updatePosition();
    const scrollOpts = { capture: true } as const;
    window.addEventListener("scroll", updatePosition, scrollOpts);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, scrollOpts);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, summary.recent_payments.length]);

  const line = formatCoachPaymentsCellLine(summary);
  const panel =
    open && position && summary.recent_payments.length > 0 ? (
      <div
        id={panelId}
        role="dialog"
        aria-label={`Payments for ${coachName}`}
        className="fixed z-[220] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
        style={{
          left: position.left,
          top: position.top,
          width: Math.min(POPOVER_WIDTH_PX, window.innerWidth - 24),
        }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        <div className="h-2 w-full bg-emerald-500" aria-hidden />
        <div className="px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-slate-900">
            {coachName}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {summary.succeeded_count} successful payment
            {summary.succeeded_count === 1 ? "" : "s"}
            {summary.totals_by_currency.length > 1 ? " · multi-currency" : ""}
          </p>
          {summary.totals_by_currency.length > 1 ? (
            <p className="mt-1 text-[11px] text-slate-600">
              {summary.totals_by_currency
                .map(({ currency, cents }) =>
                  formatPaymentMoney(cents, currency)
                )
                .join(" · ")}
            </p>
          ) : null}
          <ul
            className="mt-2 space-y-0.5 overflow-y-auto"
            style={{ maxHeight: POPOVER_MAX_HEIGHT }}
          >
            {summary.recent_payments.map((payment) => (
              <li key={payment.id}>
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-2 px-1.5 py-0.5 text-sm leading-snug">
                  <span className="shrink-0 tabular-nums text-xs text-slate-400">
                    {formatPaymentDate(payment.paid_at)}
                  </span>
                  <span
                    className={`inline-flex max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium ${paymentBillingKindBadgeClass(payment.billing_kind)}`}
                  >
                    {paymentBillingKindLabel(payment.billing_kind)}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-700">
                    {formatPaymentMoney(payment.amount_cents, payment.currency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <Link
              href={`/admin/coaches/${encodeURIComponent(coachId)}?tab=payments`}
              className="text-xs font-medium text-sky-600 hover:text-sky-700"
              onClick={hide}
            >
              View all payments →
            </Link>
          </div>
        </div>
      </div>
    ) : null;

  if (!line) {
    return (
      <span className="text-xs text-slate-400" aria-label="No payments">
        —
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={line}
        aria-label={`Payments: ${line}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        className="block max-w-[14rem] truncate text-left text-xs text-slate-700 underline decoration-slate-300 decoration-dotted underline-offset-2 hover:text-slate-900 hover:decoration-slate-500"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        onClick={toggle}
      >
        {children}
      </button>
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}

export function CoachPaymentsCellContent({
  summary,
}: {
  summary: CoachPaymentSummary;
}) {
  const line = formatCoachPaymentsCellLine(summary);
  return line ? <span className="truncate">{line}</span> : null;
}

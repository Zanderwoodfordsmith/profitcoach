"use client";

import { ChevronDown, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";

import type { CoachPaymentSummary } from "@/lib/admin/coachPaymentSummary";
import {
  formatPaymentDate,
  formatPaymentMoney,
} from "@/lib/adminPaymentDisplay";
import {
  paymentBillingKindBadgeClass,
  paymentBillingKindLabel,
} from "@/lib/paymentBillingKind";
import { supabaseClient } from "@/lib/supabaseClient";

type LoadedPayments = {
  summary: CoachPaymentSummary;
  slug: string | null;
};

const cache = new Map<string, LoadedPayments>();

export function SupportTicketCoachPayments({
  coachId,
}: {
  coachId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedPayments | null>(null);

  useEffect(() => {
    setError(null);
    if (coachId && cache.has(coachId)) {
      setLoaded(cache.get(coachId) ?? null);
      setLoading(false);
      return;
    }
    setLoaded(null);
    if (open && coachId) setLoading(true);
  }, [coachId, open]);

  useEffect(() => {
    if (!open || !coachId || cache.has(coachId)) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) {
          setError("Couldn't load payments.");
          setLoading(false);
        }
        return;
      }

      const res = await fetch(
        `/api/admin/support/coach-payments?coachId=${encodeURIComponent(coachId)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const body = (await res.json().catch(() => ({}))) as {
        slug?: string | null;
        summary?: CoachPaymentSummary;
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok || !body.summary) {
        setError(body.error ?? "Couldn't load payments.");
        setLoading(false);
        return;
      }

      const next: LoadedPayments = {
        summary: body.summary,
        slug: body.slug ?? null,
      };
      cache.set(coachId, next);
      setLoaded(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, coachId]);

  const summary = loaded?.summary ?? null;

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
      >
        <span className="inline-flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" aria-hidden />
          Payments
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-slate-200 px-2.5 py-2">
          {!coachId ? (
            <p className="px-0.5 text-xs text-slate-500">
              Link a coach to see their payments.
            </p>
          ) : loading && !summary ? (
            <p className="px-0.5 text-xs text-slate-500">Loading payments…</p>
          ) : error ? (
            <p className="px-0.5 text-xs text-rose-700">{error}</p>
          ) : summary && !loaded?.slug ? (
            <p className="px-0.5 text-xs text-slate-500">
              This person doesn&apos;t have a coach profile.
            </p>
          ) : summary && summary.succeeded_count === 0 ? (
            <p className="px-0.5 text-xs text-slate-500">No payments yet.</p>
          ) : summary ? (
            <>
              <ul className="space-y-0.5">
                {summary.recent_payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-2 px-0.5 py-0.5"
                  >
                    <span className="tabular-nums text-xs text-slate-400">
                      {formatPaymentDate(payment.paid_at)}
                    </span>
                    <span
                      className={`inline-flex max-w-full truncate rounded-full px-1.5 py-0.5 text-caption font-medium ${paymentBillingKindBadgeClass(payment.billing_kind)}`}
                    >
                      {paymentBillingKindLabel(payment.billing_kind)}
                    </span>
                    <span className="shrink-0 tabular-nums text-sm text-slate-700">
                      {formatPaymentMoney(payment.amount_cents, payment.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

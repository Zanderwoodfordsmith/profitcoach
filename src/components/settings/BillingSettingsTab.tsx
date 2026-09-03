"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { type MembershipInterval, type MembershipPlanKey } from "@/config/membershipPlans";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { buildCoachBillingOverview } from "@/lib/admin/paymentPlanRemaining";
import {
  paymentBillingKindLabel,
  type PaymentBillingKind,
} from "@/lib/paymentBillingKind";
import { supabaseClient } from "@/lib/supabaseClient";

type PlanInfo = {
  key: MembershipPlanKey;
  label: string;
  monthlyPriceGbp: number;
  annualPriceGbp: number;
  checkoutAvailable: { month: boolean; year: boolean };
  isCurrent: boolean;
  relation: "upgrade" | "downgrade" | "current";
};

type BillingPayment = {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: string;
  billingKind: PaymentBillingKind | null;
};

type BillingPayload = {
  tierLabel: string;
  subscription: {
    status: string | null;
    interval: MembershipInterval | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  paymentMethod: {
    type: string;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
  } | null;
  recurringPaymentStatus: string | null;
  recurringActive?: boolean;
  plans: PlanInfo[];
  payments: BillingPayment[];
  stripeConfigured: boolean;
};

function authHeaders(impersonatingCoachId: string | null) {
  return async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  };
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPaymentDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`;
  }
}

function formatPlanMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amountCents / 100);
  } catch {
    return `${currency.toUpperCase()} ${Math.round(amountCents / 100)}`;
  }
}

function statusLabel(status: string | null, cancelAtPeriodEnd: boolean): string {
  if (cancelAtPeriodEnd) return "Cancels at period end";
  if (status === "active") return "Active";
  if (status === "trialing") return "Trial";
  if (status === "past_due") return "Past due";
  if (status === "canceled") return "Canceled";
  return status ?? "No active subscription";
}

function billingKindLabel(kind: PaymentBillingKind | null): string {
  if (!kind || kind === "other") return "Payment";
  if (kind === "recurring") return "Subscription";
  return paymentBillingKindLabel(kind);
}

function isSucceededPayment(status: string): boolean {
  return status === "succeeded" || status === "paid";
}

function paymentStatusClass(status: string): string {
  if (status === "succeeded" || status === "paid") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (status === "failed" || status === "payment_failed") {
    return "bg-rose-50 text-rose-700";
  }
  return "bg-slate-100 text-slate-600";
}

function BillingSkeleton() {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-5" aria-label="Loading billing">
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="h-36 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-36 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
      <div className="h-52 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
  );
}

export function BillingSettingsTab() {
  const { impersonatingCoachId } = useImpersonation();
  const [data, setData] = useState<BillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const getHeaders = authHeaders(impersonatingCoachId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/membership", {
        headers: await getHeaders(),
      });
      const body = (await res.json().catch(() => ({}))) as BillingPayload & {
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Could not load billing.");
        setData(null);
      } else {
        setData(body);
      }
    } catch {
      setError("Could not load billing. Please try again.");
    } finally {
      setLoading(false);
    }
    // getHeaders is stable for the current impersonation context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impersonatingCoachId]);

  useEffect(() => {
    void load();
  }, [load]);

  const billingOverview = useMemo(
    () =>
      buildCoachBillingOverview(
        (data?.payments ?? []).map((payment) => ({
          amount_cents: payment.amountCents,
          currency: payment.currency,
          status: payment.status === "paid" ? "succeeded" : payment.status,
          billing_kind:
            payment.billingKind === "recurring" ||
            payment.billingKind === "initial" ||
            payment.billingKind === "installment" ||
            payment.billingKind === "other"
              ? payment.billingKind
              : "other",
        }))
      ),
    [data?.payments]
  );

  async function openPortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/membership/portal", {
        method: "POST",
        headers: await getHeaders(),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Could not open billing portal.");
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Could not open billing portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) return <BillingSkeleton />;

  if (error || !data) {
    return (
      <div className="w-full max-w-2xl rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
        <p className="text-sm font-medium text-rose-800">
          {error ?? "Billing is unavailable."}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-800 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      </div>
    );
  }

  const hasSubscription = Boolean(data.subscription.status);
  const isComplimentary = data.recurringPaymentStatus === "complimentary";
  const isIncludedPeriod = data.recurringPaymentStatus === "first_6_months";
  const hasCoveredArrangement =
    Boolean(data.recurringActive) ||
    isIncludedPeriod ||
    isComplimentary;
  const nextBillingDate = formatDate(data.subscription.currentPeriodEnd);
  const visiblePlans = data.plans.filter((plan) => plan.checkoutAvailable.month);
  const succeededPayments = data.payments.filter((payment) =>
    isSucceededPayment(payment.status)
  );
  const remainingLine = billingOverview.remainingByCurrency
    .map((row) => {
      const remaining = formatPlanMoney(row.remainingCents, row.currency);
      if (row.installmentsPaid != null && row.installmentCount != null) {
        return `Remaining ${remaining} · ${row.installmentsPaid} of ${row.installmentCount} on the plan`;
      }
      return `Remaining ${remaining}`;
    })
    .join(" · ");
  const paymentMethodLabel =
    isComplimentary || isIncludedPeriod
      ? "No payment method required"
      : data.paymentMethod?.last4
        ? `${data.paymentMethod.brand ?? "Card"} ending ${data.paymentMethod.last4}`
        : data.paymentMethod
          ? data.paymentMethod.type
          : "Managed securely in Stripe";
  const planDescription = hasSubscription
    ? nextBillingDate
      ? `Your next payment is due on ${nextBillingDate}.`
      : "Your subscription is active."
    : isComplimentary
      ? "Your membership is complimentary. No payment needed."
      : isIncludedPeriod
        ? "You're still in your first 6 months. Nothing to do yet."
        : hasCoveredArrangement
          ? "Your access is being handled through an existing recurring arrangement."
          : "You do not have an active Stripe subscription.";

  return (
    <div className="flex w-full max-w-4xl flex-col gap-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_35px_-28px_rgba(15,23,42,0.55)]">
        <div className="h-1 bg-gradient-to-r from-[#063056] via-[#0c5290] to-[#42a1ee]" />
        <div className="flex flex-col gap-6 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Current plan
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {data.tierLabel}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    data.subscription.cancelAtPeriodEnd
                      ? "bg-amber-50 text-amber-700"
                      : hasSubscription
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {statusLabel(
                    data.subscription.status,
                    data.subscription.cancelAtPeriodEnd
                  )}
                </span>
              </div>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                {planDescription}
              </p>
              {remainingLine ? (
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {remainingLine}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {hasSubscription ? (
                <button
                  type="button"
                  onClick={() => void openPortal()}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0c5290] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#063056] focus:outline-none focus:ring-2 focus:ring-[#42a1ee]/50 disabled:cursor-wait disabled:opacity-60"
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <CreditCard className="h-4 w-4" aria-hidden />
                  )}
                  Manage billing
                </button>
              ) : null}
              {!hasSubscription && !isComplimentary ? (
                <Link
                  href="/coach/membership#plans"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0c5290] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#063056] focus:outline-none focus:ring-2 focus:ring-[#42a1ee]/50"
                >
                  View plans
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>
          {data.subscription.cancelAtPeriodEnd ? (
            <div className="flex gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <p>
                Your subscription will remain active until{" "}
                <strong>{nextBillingDate ?? "the end of your current period"}</strong>.
                You can use Manage billing to review or change this.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(15,23,42,0.55)] sm:p-6">
          <div className="flex items-center gap-2 text-slate-900">
            <CreditCard className="h-4 w-4 text-[#0c5290]" aria-hidden />
            <h2 className="text-sm font-semibold">Payment method</h2>
          </div>
          <p className="mt-4 text-base font-medium text-slate-900">{paymentMethodLabel}</p>
          {isComplimentary || isIncludedPeriod ? (
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Your current arrangement does not require a payment method.
            </p>
          ) : data.paymentMethod?.expMonth && data.paymentMethod.expYear ? (
            <p className="mt-1 text-sm text-slate-500">
              Expires {String(data.paymentMethod.expMonth).padStart(2, "0")}/
              {data.paymentMethod.expYear}
            </p>
          ) : (
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Update your card or billing details in the secure Stripe portal.
            </p>
          )}
          {hasSubscription ? (
            <button
              type="button"
              onClick={() => void openPortal()}
              disabled={portalLoading}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c5290] underline decoration-[#42a1ee]/50 underline-offset-4 transition hover:text-[#063056] focus:outline-none focus:ring-2 focus:ring-[#42a1ee]/40"
            >
              Update payment method
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(15,23,42,0.55)] sm:p-6">
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-4 w-4 text-[#0c5290]" aria-hidden />
            <h2 className="text-sm font-semibold">Billing support</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Billing changes are handled securely by Stripe. Your card details never pass
            through this app.
          </p>
          <Link
            href="/coach/support"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c5290] underline decoration-[#42a1ee]/50 underline-offset-4 transition hover:text-[#063056] focus:outline-none focus:ring-2 focus:ring-[#42a1ee]/40"
          >
            Contact support
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </section>
      </div>

      {visiblePlans.length > 0 ? (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(15,23,42,0.55)] sm:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Change plan</h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose the level of support that fits your business now.
              </p>
            </div>
            <Link
              href="/coach/membership#plans"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#0c5290] hover:text-[#063056]"
            >
              Compare all features
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {visiblePlans.map((plan) => {
              const current = plan.isCurrent;
              return (
                <div
                  key={plan.key}
                  className={`rounded-xl border p-4 ${
                    current
                      ? "border-[#42a1ee] bg-sky-50/50"
                      : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{plan.label}</p>
                    {current ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0c5290]">
                        <Check className="h-3 w-3" aria-hidden />
                        Current
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    £{plan.monthlyPriceGbp.toLocaleString("en-GB")}
                    <span className="text-slate-400"> / month</span>
                  </p>
                  {!current ? (
                    <Link
                      href={`/api/coach/membership/checkout?plan=${encodeURIComponent(
                        plan.key
                      )}&interval=month`}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c5290] hover:text-[#063056]"
                    >
                      {plan.relation === "upgrade" ? "Upgrade" : "Switch plan"}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_35px_-28px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-1 border-b border-slate-200/80 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-900">
              <FileText className="h-4 w-4 text-[#0c5290]" aria-hidden />
              <h2 className="text-sm font-semibold">Payment history</h2>
            </div>
            <span className="text-xs text-slate-600">
              {billingOverview.succeededCount}{" "}
              {billingOverview.succeededCount === 1 ? "payment" : "payments"}
            </span>
          </div>
          {remainingLine ? (
            <p className="text-sm font-medium text-slate-800">{remainingLine}</p>
          ) : null}
        </div>
        {succeededPayments.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {succeededPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileText className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {billingKindLabel(payment.billingKind)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatPaymentDate(payment.paidAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 pl-11 sm:pl-0">
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${paymentStatusClass(
                      payment.status
                    )}`}
                  >
                    {payment.status.replaceAll("_", " ")}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatCurrency(payment.amountCents, payment.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center sm:px-6">
            <FileText className="mx-auto h-5 w-5 text-slate-400" aria-hidden />
            <p className="mt-2 text-sm font-medium text-slate-700">No payments recorded yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Payments made through this account will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

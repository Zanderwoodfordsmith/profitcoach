"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { INVOICE_VAT_NOTE } from "@/config/invoiceSeller";
import { type MembershipInterval, type MembershipPlanKey } from "@/config/membershipPlans";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { buildCoachBillingOverview } from "@/lib/admin/paymentPlanRemaining";
import { INVOICE_DETAIL_LIMITS, invoiceLine } from "@/lib/invoices/coachInvoice";
import type { PaymentBillingKind } from "@/lib/paymentBillingKind";
import { supabaseClient } from "@/lib/supabaseClient";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass, fieldLabelClass } from "@/components/ui/Field";
import { badgeClass } from "@/components/ui/Badge";

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
  invoiceAvailable?: boolean;
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

const BRAND_LABELS: Record<string, string> = {
  amex: "American Express",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
  bacs_debit: "Bacs Direct Debit",
  sepa_debit: "SEPA Direct Debit",
};

/** Stripe sends brands in lower case ("mastercard"); show them as names. */
function brandLabel(value: string): string {
  const known = BRAND_LABELS[value.toLowerCase()];
  if (known) return known;
  return value
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isSucceededPayment(status: string): boolean {
  return status === "succeeded" || status === "paid";
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
  const [checkoutPlan, setCheckoutPlan] = useState<MembershipPlanKey | null>(null);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const getHeaders = authHeaders(impersonatingCoachId);

  // Fetched rather than linked, because the download needs the sign-in header.
  async function downloadInvoice(paymentId: string) {
    setInvoiceBusyId(paymentId);
    setInvoiceError(null);
    try {
      const res = await fetch(`/api/coach/invoices/${encodeURIComponent(paymentId)}`, {
        headers: await getHeaders(),
      });
      if (!res.ok) throw new Error();
      const name = /filename="([^"]+)"/.exec(
        res.headers.get("Content-Disposition") ?? ""
      )?.[1];
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name ?? "Invoice.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setInvoiceError("Could not download that invoice. Please try again.");
    } finally {
      setInvoiceBusyId(null);
    }
  }

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

  // Signed-in checkout: an active subscription switches price straight away,
  // otherwise Stripe Checkout opens on the coach's own Stripe customer.
  async function startCheckout(plan: PlanInfo, switchesNow: boolean) {
    if (
      switchesNow &&
      !window.confirm(
        `Move to ${plan.label} at £${plan.monthlyPriceGbp.toLocaleString("en-GB")} a month? Your card is charged or credited the difference for this month.`
      )
    ) {
      return;
    }
    setCheckoutPlan(plan.key);
    setError(null);
    try {
      const res = await fetch("/api/coach/membership", {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({ plan: plan.key, interval: "month" }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Could not start checkout.");
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Could not start checkout. Please try again.");
    } finally {
      setCheckoutPlan(null);
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
          className={buttonClass("second", "normal", "mt-4")}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      </div>
    );
  }

  const hasSubscription = Boolean(data.subscription.status);
  // Mirrors the server: these statuses get switched in place, not sent to checkout.
  const subscriptionActive =
    data.subscription.status === "active" ||
    data.subscription.status === "trialing" ||
    data.subscription.status === "past_due";
  const isComplimentary = data.recurringPaymentStatus === "complimentary";
  const isIncludedPeriod = data.recurringPaymentStatus === "first_6_months";
  const hasCoveredArrangement =
    Boolean(data.recurringActive) ||
    isIncludedPeriod ||
    isComplimentary;
  const nextBillingDate = formatDate(data.subscription.currentPeriodEnd);
  const visiblePlans = data.plans.filter(
    (plan) => plan.key !== "core" && plan.checkoutAvailable.month
  );
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
        ? `${data.paymentMethod.brand ? brandLabel(data.paymentMethod.brand) : "Card"} ending ${data.paymentMethod.last4}`
        : data.paymentMethod
          ? brandLabel(data.paymentMethod.type)
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
      <section className={cardClass("plain", "overflow-hidden")}>
        <div className="h-1 bg-gradient-to-r from-[#063056] via-[#0c5290] to-[#42a1ee]" />
        <div className="flex flex-col gap-6 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-kicker font-semibold uppercase text-slate-500">
                Current plan
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {data.tierLabel}
                </h2>
                <span
                  className={badgeClass(
                    data.subscription.cancelAtPeriodEnd
                      ? "amber"
                      : hasSubscription
                        ? "green"
                        : "grey"
                  )}
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
                <p className="mt-3 text-sm font-medium text-slate-900">
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
                  className={buttonClass("main", "normal", "disabled:cursor-wait")}
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
                  className={buttonClass("main")}
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
        <section className={cardClass("plain", "p-5 sm:p-6")}>
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

        <section className={cardClass("plain", "p-5 sm:p-6")}>
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
        <section className={cardClass("plain", "p-5 sm:p-6")}>
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
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                      <span className="inline-flex items-center gap-1 text-caption font-semibold text-[#0c5290]">
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
                    <button
                      type="button"
                      onClick={() => void startCheckout(plan, subscriptionActive)}
                      disabled={checkoutPlan !== null}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c5290] hover:text-[#063056] disabled:cursor-wait disabled:opacity-60"
                    >
                      {plan.relation === "upgrade"
                        ? "Upgrade"
                        : plan.relation === "current"
                          ? "Restart plan"
                          : "Switch plan"}
                      {checkoutPlan === plan.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className={cardClass("plain", "overflow-hidden")}>
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-slate-900">
            <FileText className="h-4 w-4 text-[#0c5290]" aria-hidden />
            <h2 className="text-ui font-semibold">Payments and invoices</h2>
          </div>
          {succeededPayments.length > 0 ? (
            <span className="text-caption text-slate-500">
              {billingOverview.succeededCount}{" "}
              {billingOverview.succeededCount === 1 ? "payment" : "payments"}
            </span>
          ) : null}
        </div>
        {succeededPayments.length > 0 ? (
          <>
            <InvoiceMadeOutTo getHeaders={getHeaders} />
            {invoiceError ? (
              <p role="alert" className="border-t border-slate-100 px-5 py-2.5 text-caption text-rose-700 sm:px-6">
                {invoiceError}
              </p>
            ) : null}
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {succeededPayments.map((payment) => {
                const date = formatPaymentDate(payment.paidAt);
                return (
                  <li
                    key={payment.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-5 py-2.5 sm:grid-cols-[6.5rem_1fr_auto_7rem] sm:px-6"
                  >
                    <span className="order-3 text-caption text-slate-500 sm:order-none sm:text-ui">
                      {date}
                    </span>
                    <span className="order-1 min-w-0 truncate text-ui text-slate-900 sm:order-none">
                      {invoiceLine(payment.billingKind).detail}
                    </span>
                    <span className="order-2 text-right text-ui font-medium tabular-nums text-slate-900 sm:order-none">
                      {formatCurrency(payment.amountCents, payment.currency)}
                    </span>
                    <span className="order-4 justify-self-end sm:order-none">
                      {payment.invoiceAvailable ? (
                        <button
                          type="button"
                          onClick={() => void downloadInvoice(payment.id)}
                          disabled={invoiceBusyId === payment.id}
                          aria-label={`Download invoice for ${date}`}
                          className={buttonClass("quiet", "small", "-mr-3.5 disabled:cursor-wait")}
                        >
                          {invoiceBusyId === payment.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Download className="h-3.5 w-3.5" aria-hidden />
                          )}
                          Invoice
                        </button>
                      ) : (
                        <Link
                          href="/coach/support"
                          className={buttonClass("quiet", "small", "-mr-3.5")}
                        >
                          Ask for invoice
                        </Link>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-slate-100 px-5 py-3 text-caption text-slate-500 sm:px-6">
              {INVOICE_VAT_NOTE}
            </p>
          </>
        ) : (
          <div className="border-t border-slate-100 px-5 py-8 text-center sm:px-6">
            <p className="text-ui font-medium text-slate-700">No payments recorded yet</p>
            <p className="mt-1 text-ui text-slate-500">
              Your payments and invoices will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

type InvoiceForm = {
  business_name: string;
  address: string;
  company_number: string;
  vat_number: string;
};

/** One line saying who invoices are made out to; opens in place to change it. */
function InvoiceMadeOutTo({
  getHeaders,
}: {
  getHeaders: () => Promise<Record<string, string>>;
}) {
  const [saved, setSaved] = useState<InvoiceForm | null>(null);
  const [coachName, setCoachName] = useState("");
  const [draft, setDraft] = useState<InvoiceForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const res = await fetch("/api/coach/invoices/details", {
        headers: await getHeaders(),
      }).catch(() => null);
      if (!live) return;
      if (!res?.ok) {
        setLoadFailed(true);
        return;
      }
      const body = (await res.json()) as InvoiceForm & { coach_name: string };
      setCoachName(body.coach_name);
      setSaved({
        business_name: body.business_name,
        address: body.address,
        company_number: body.company_number,
        vat_number: body.vat_number,
      });
    })();
    return () => {
      live = false;
    };
    // getHeaders is stable for the current impersonation context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/invoices/details", {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not save. Please try again.");
        return;
      }
      setSaved(draft);
      setDraft(null);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loadFailed) {
    return (
      <p className="border-t border-slate-100 px-5 py-2.5 text-caption text-rose-700 sm:px-6">
        Could not load who your invoices are made out to.
      </p>
    );
  }

  if (draft) {
    const field = (key: keyof InvoiceForm, label: string) => (
      <label className={fieldLabelClass}>
        {label}
        <input
          type="text"
          value={draft[key]}
          maxLength={INVOICE_DETAIL_LIMITS[key]}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          autoFocus={key === "business_name"}
          className={fieldClass("input", "normal", "mt-1.5 font-normal")}
        />
      </label>
    );
    return (
      <form
        className="grid gap-4 border-t border-slate-100 px-5 py-5 sm:grid-cols-2 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-ui text-slate-600 sm:col-span-2">
          These show on all your invoices. Only fill in what you need.
        </p>
        <div className="sm:col-span-2">{field("business_name", "Business name")}</div>
        <label className={`${fieldLabelClass} sm:col-span-2`}>
          Address
          <textarea
            rows={3}
            value={draft.address}
            maxLength={INVOICE_DETAIL_LIMITS.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            className={fieldClass("textarea", "normal", "mt-1.5 resize-none font-normal")}
          />
        </label>
        {field("company_number", "Company number")}
        {field("vat_number", "VAT number")}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className={buttonClass("main", "small", "disabled:cursor-wait")}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setError(null);
            }}
            className={buttonClass("quiet", "small")}
          >
            Cancel
          </button>
          {error ? (
            <span role="alert" className="text-caption text-rose-700">
              {error}
            </span>
          ) : null}
        </div>
      </form>
    );
  }

  const business = saved?.business_name.trim();
  const hasDetails = Boolean(
    saved && Object.values(saved).some((value) => value.trim())
  );
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-1.5 sm:px-6">
      <p className="min-w-0 text-ui text-slate-600">
        {saved ? (
          <>
            Made out to{" "}
            <span className="font-medium text-slate-900">
              {business || coachName || "you"}
            </span>
          </>
        ) : (
          <span className="invisible">Made out to</span>
        )}
      </p>
      {saved ? (
        <button
          type="button"
          onClick={() => setDraft(saved)}
          className={buttonClass("quiet", "small", "-mr-3.5 shrink-0")}
        >
          {hasDetails ? "Change" : "Add details"}
        </button>
      ) : null}
    </div>
  );
}

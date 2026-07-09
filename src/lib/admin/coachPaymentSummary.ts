import { formatPaymentDate, formatPaymentMoney } from "@/lib/adminPaymentDisplay";
import {
  buildPaymentBillingKindIndex,
  resolvePaymentBillingKind,
  type PaymentBillingKind,
  type PaymentForBillingKind,
} from "@/lib/paymentBillingKind";

export type CoachPaymentSummaryRecent = {
  id: string;
  amount_cents: number;
  currency: string;
  paid_at: string;
  billing_kind: PaymentBillingKind;
};

export type CoachPaymentSummary = {
  succeeded_count: number;
  last_paid_at: string | null;
  totals_by_currency: Array<{ currency: string; cents: number }>;
  recent_payments: CoachPaymentSummaryRecent[];
};

const RECENT_PAYMENT_LIMIT = 5;

function comparePaidAtDesc(a: PaymentForBillingKind, b: PaymentForBillingKind): number {
  return Date.parse(b.paid_at) - Date.parse(a.paid_at);
}

function pickPrimaryCurrency(
  totals: Array<{ currency: string; cents: number }>
): string {
  if (totals.some((row) => row.currency.toUpperCase() === "GBP")) return "GBP";
  if (totals.some((row) => row.currency.toUpperCase() === "USD")) return "USD";
  return totals[0]?.currency.toUpperCase() ?? "GBP";
}

export function buildCoachPaymentSummary(
  payments: PaymentForBillingKind[]
): CoachPaymentSummary {
  const sorted = [...payments].sort(comparePaidAtDesc);
  const totalsByCurrency = new Map<string, number>();

  for (const payment of sorted) {
    const code = payment.currency.toUpperCase();
    totalsByCurrency.set(
      code,
      (totalsByCurrency.get(code) ?? 0) + payment.amount_cents
    );
  }

  const billingKindById = buildPaymentBillingKindIndex(sorted);

  return {
    succeeded_count: sorted.length,
    last_paid_at: sorted[0]?.paid_at ?? null,
    totals_by_currency: [...totalsByCurrency.entries()]
      .map(([currency, cents]) => ({ currency, cents }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    recent_payments: sorted.slice(0, RECENT_PAYMENT_LIMIT).map((payment) => ({
      id: payment.id,
      amount_cents: payment.amount_cents,
      currency: payment.currency,
      paid_at: payment.paid_at,
      billing_kind: resolvePaymentBillingKind(
        billingKindById.get(payment.id) ?? "other",
        payment.billing_kind_override
      ),
    })),
  };
}

export function formatCoachPaymentsCellLine(
  summary: CoachPaymentSummary | null | undefined
): string | null {
  if (!summary || summary.succeeded_count === 0) return null;

  const primaryCurrency = pickPrimaryCurrency(summary.totals_by_currency);
  const primaryTotal =
    summary.totals_by_currency.find(
      (row) => row.currency.toUpperCase() === primaryCurrency
    )?.cents ?? 0;

  const totalLabel = formatPaymentMoney(primaryTotal, primaryCurrency);
  const countLabel = `${summary.succeeded_count} payment${
    summary.succeeded_count === 1 ? "" : "s"
  }`;
  const lastLabel = summary.last_paid_at
    ? `last ${formatPaymentDate(summary.last_paid_at)}`
    : null;

  return lastLabel
    ? `${totalLabel} · ${countLabel} · ${lastLabel}`
    : `${totalLabel} · ${countLabel}`;
}

export function formatCoachPaymentsExportValue(
  summary: CoachPaymentSummary | null | undefined
): string {
  return formatCoachPaymentsCellLine(summary) ?? "";
}

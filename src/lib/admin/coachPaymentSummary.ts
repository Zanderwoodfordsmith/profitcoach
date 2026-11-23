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
  /** Set when every payment was the same amount (a plan or a monthly), for "2 × £2.5k". */
  same_amount?: { cents: number; currency: string } | null;
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
  payments: PaymentForBillingKind[],
  recentLimit = RECENT_PAYMENT_LIMIT
): CoachPaymentSummary {
  const sorted = [...payments]
    .filter((payment) => payment.status === "succeeded")
    .sort(comparePaidAtDesc);
  const totalsByCurrency = new Map<string, number>();

  for (const payment of sorted) {
    const code = payment.currency.toUpperCase();
    totalsByCurrency.set(
      code,
      (totalsByCurrency.get(code) ?? 0) + payment.amount_cents
    );
  }

  const billingKindById = buildPaymentBillingKindIndex(sorted);
  const first = sorted[0];
  const sameAmount =
    first &&
    sorted.every(
      (p) => p.amount_cents === first.amount_cents && p.currency === first.currency
    )
      ? { cents: first.amount_cents, currency: first.currency }
      : null;

  return {
    succeeded_count: sorted.length,
    last_paid_at: sorted[0]?.paid_at ?? null,
    totals_by_currency: [...totalsByCurrency.entries()]
      .map(([currency, cents]) => ({ currency, cents }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    same_amount: sameAmount,
    recent_payments: sorted.slice(0, Math.max(0, recentLimit)).map((payment) => ({
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

/** "16 May", or "16 May '25" in another year: matches the Joined column. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
  return d.getFullYear() === new Date().getFullYear()
    ? dayMonth
    : `${dayMonth} '${String(d.getFullYear()).slice(-2)}`;
}

/** £495, £2.5k, £10k, £12.9k: short money for the table. */
function shortMoney(cents: number, currency: string): string {
  const major = cents / 100;
  let symbol = currency.toUpperCase() + " ";
  try {
    symbol =
      new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase(), currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? symbol;
  } catch {
    /* keep the code */
  }
  if (major < 1000) return `${symbol}${Math.round(major).toLocaleString("en-GB")}`;
  // £1.75k keeps plan amounts exact; £10k+ rounds to one decimal (£18.5k).
  const places = major >= 10_000 ? 10 : 100;
  const k = Math.round((major / 1000) * places) / places;
  return `${symbol}${k}k`;
}

/**
 * The table's short payments line (21 Nov): "£10k", "2 × £2.5k" or
 * "£12.9k in 5", plus the last payment date on its own.
 */
export function formatCoachPaymentsCellShort(
  summary: CoachPaymentSummary | null | undefined
): { amount: string; date: string | null } | null {
  if (!summary || summary.succeeded_count === 0) return null;
  const date = summary.last_paid_at ? shortDate(summary.last_paid_at) : null;
  const same = summary.same_amount;
  if (same) {
    const each = shortMoney(same.cents, same.currency);
    return { amount: summary.succeeded_count === 1 ? each : `${summary.succeeded_count} × ${each}`, date };
  }
  const currency = pickPrimaryCurrency(summary.totals_by_currency);
  const total = summary.totals_by_currency.find((row) => row.currency.toUpperCase() === currency)?.cents ?? 0;
  return { amount: `${shortMoney(total, currency)} in ${summary.succeeded_count}`, date };
}

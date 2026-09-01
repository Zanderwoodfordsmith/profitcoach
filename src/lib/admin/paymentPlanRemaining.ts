import {
  inferInstallmentCount,
  isOneTimePlanPayment,
  isRecognizedPlanInstallmentAmount,
  ongoingPlanInstallmentCents,
} from "@/lib/cashFlowForecast/paymentPlanInference";
import {
  establishedCustomerPriorTotalCents,
  isAnnual10MonthSubscriptionAmount,
  isAnnual12MonthSubscriptionAmount,
  isProgrammeUpfrontAmount,
  isRecurringSubscriptionAmount,
  type PaymentBillingKind,
} from "@/lib/paymentBillingKind";

export type PaymentForPlanRemaining = {
  amount_cents: number;
  currency: string;
  status: string;
  billing_kind: PaymentBillingKind;
};

export type CoachBillingMoneyRow = {
  currency: string;
  cents: number;
};

export type CoachPlanRemainingRow = {
  currency: string;
  paidCents: number;
  expectedCents: number;
  remainingCents: number;
  installmentsPaid: number | null;
  installmentCount: number | null;
};

export type CoachBillingOverview = {
  succeededCount: number;
  totalsByCurrency: CoachBillingMoneyRow[];
  remainingByCurrency: CoachPlanRemainingRow[];
};

const KNOWN_UPFRONT_PROGRAMME_TOTALS_CENTS: Record<string, number[]> = {
  GBP: [780_000, 960_000, 990_000],
  USD: [780_000, 960_000, 1_290_000],
};

function currencyKey(currency: string): string {
  return currency.trim().toUpperCase() || "GBP";
}

function isSubscriptionLikeAmount(amountCents: number, currency: string): boolean {
  return (
    isRecurringSubscriptionAmount(amountCents, currency) ||
    isAnnual10MonthSubscriptionAmount(amountCents, currency) ||
    isAnnual12MonthSubscriptionAmount(amountCents, currency)
  );
}

function isPlanInstallmentPayment(payment: PaymentForPlanRemaining): boolean {
  if (payment.billing_kind === "recurring") return false;
  if (!isRecognizedPlanInstallmentAmount(payment.amount_cents, payment.currency)) {
    return false;
  }
  if (payment.billing_kind === "installment") return true;
  if (isSubscriptionLikeAmount(payment.amount_cents, payment.currency)) {
    return false;
  }
  return (
    payment.billing_kind === "initial" || payment.billing_kind === "other"
  );
}

export function buildCoachBillingOverview(
  payments: PaymentForPlanRemaining[]
): CoachBillingOverview {
  const succeeded = payments.filter((payment) => payment.status === "succeeded");
  const totalsByCurrency = new Map<string, number>();

  for (const payment of succeeded) {
    const code = currencyKey(payment.currency);
    totalsByCurrency.set(
      code,
      (totalsByCurrency.get(code) ?? 0) + payment.amount_cents
    );
  }

  return {
    succeededCount: succeeded.length,
    totalsByCurrency: [...totalsByCurrency.entries()]
      .map(([currency, cents]) => ({ currency, cents }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    remainingByCurrency: inferPlanRemaining(succeeded),
  };
}

function inferPlanRemaining(
  succeeded: PaymentForPlanRemaining[]
): CoachPlanRemainingRow[] {
  const nonRecurring = succeeded.filter(
    (payment) => payment.billing_kind !== "recurring"
  );
  const byCurrency = new Map<string, PaymentForPlanRemaining[]>();

  for (const payment of nonRecurring) {
    const code = currencyKey(payment.currency);
    const list = byCurrency.get(code) ?? [];
    list.push(payment);
    byCurrency.set(code, list);
  }

  const rows: CoachPlanRemainingRow[] = [];

  for (const [currency, currencyPayments] of byCurrency) {
    const paidCents = currencyPayments.reduce(
      (sum, payment) => sum + payment.amount_cents,
      0
    );
    const planPayments = currencyPayments.filter(isPlanInstallmentPayment);
    const planPaidCents = planPayments.reduce(
      (sum, payment) => sum + payment.amount_cents,
      0
    );

    let expectedCents = 0;
    let installmentsPaid: number | null = null;
    let installmentCount: number | null = null;

    if (planPayments.length > 0) {
      const amounts = planPayments.map((payment) => payment.amount_cents);
      const ongoing = ongoingPlanInstallmentCents(amounts);
      const count = inferInstallmentCount(ongoing, amounts.length, currency);
      if (!isOneTimePlanPayment(amounts.length, ongoing, count)) {
        expectedCents = ongoing * count;
        installmentsPaid = amounts.length;
        installmentCount = count;
      }
    }

    const knownTotals = KNOWN_UPFRONT_PROGRAMME_TOTALS_CENTS[currency] ?? [];
    for (const totalCents of knownTotals) {
      if (currencyPayments.some((payment) => payment.amount_cents === totalCents)) {
        expectedCents = Math.max(expectedCents, totalCents);
      }
    }

    const programmeTotalCents = establishedCustomerPriorTotalCents(currency);
    const hasElevateInstallment = currencyPayments.some((payment) =>
      isProgrammeUpfrontAmount(payment.amount_cents, payment.currency)
    );
    if (hasElevateInstallment || paidCents === programmeTotalCents) {
      expectedCents = Math.max(expectedCents, programmeTotalCents);
    }

    const basisPaidCents =
      planPayments.length > 0 && expectedCents > 0 ? planPaidCents : paidCents;

    if (expectedCents > 0 && basisPaidCents > expectedCents) {
      expectedCents = basisPaidCents;
    }

    const remainingCents = Math.max(0, expectedCents - basisPaidCents);
    if (remainingCents <= 0) continue;

    rows.push({
      currency,
      paidCents: basisPaidCents,
      expectedCents,
      remainingCents,
      installmentsPaid,
      installmentCount,
    });
  }

  return rows.sort((a, b) => a.currency.localeCompare(b.currency));
}

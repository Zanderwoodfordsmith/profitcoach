import type { CoachRecurringPaymentStatus } from "@/lib/coachBilling";
import {
  buildPaymentBillingKindIndex,
  isAnnual10MonthSubscriptionAmount,
  isAnnual12MonthSubscriptionAmount,
  isRecurringSubscriptionAmount,
  resolvePaymentBillingKind,
  type PaymentForBillingKind,
} from "@/lib/paymentBillingKind";

const RECURRING_STALE_DAYS = 75;
const ANNUAL_10_MONTH_COVERAGE_DAYS = 305;
const ANNUAL_12_MONTH_COVERAGE_DAYS = 365;

function daysSince(iso: string): number {
  const ms = Date.now() - Date.parse(iso);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function statusIndicatesActiveRecurring(
  status: CoachRecurringPaymentStatus | null | undefined
): boolean {
  return (
    status === "monthly" ||
    status === "annual_prepaid" ||
    status === "first_6_months"
  );
}

function hasRecentMonthlyTierPayment(
  payments: PaymentForBillingKind[]
): boolean {
  const kindIndex = buildPaymentBillingKindIndex(payments);

  for (const payment of payments) {
    if (payment.status !== "succeeded") continue;
    if (daysSince(payment.paid_at) > RECURRING_STALE_DAYS) continue;

    const kind = resolvePaymentBillingKind(
      kindIndex.get(payment.id) ?? "other",
      payment.billing_kind_override
    );
    if (kind === "recurring") return true;

    if (
      isRecurringSubscriptionAmount(payment.amount_cents, payment.currency)
    ) {
      return true;
    }
  }

  return false;
}

function hasActiveAnnualPrepaid(payments: PaymentForBillingKind[]): boolean {
  for (const payment of payments) {
    if (payment.status !== "succeeded") continue;

    const ageDays = daysSince(payment.paid_at);
    if (
      isAnnual10MonthSubscriptionAmount(
        payment.amount_cents,
        payment.currency
      ) &&
      ageDays <= ANNUAL_10_MONTH_COVERAGE_DAYS
    ) {
      return true;
    }
    if (
      isAnnual12MonthSubscriptionAmount(
        payment.amount_cents,
        payment.currency
      ) &&
      ageDays <= ANNUAL_12_MONTH_COVERAGE_DAYS
    ) {
      return true;
    }
  }

  return false;
}

/** True when coach is on active Pro recurring billing (monthly tier or prepaid annual). */
export function coachHasActiveRecurringBilling(input: {
  recurringPaymentStatus: CoachRecurringPaymentStatus | null | undefined;
  payments: PaymentForBillingKind[];
}): boolean {
  const { recurringPaymentStatus, payments } = input;

  if (recurringPaymentStatus === "overdue") return false;
  if (statusIndicatesActiveRecurring(recurringPaymentStatus)) return true;

  const succeeded = payments
    .filter((p) => p.status === "succeeded")
    .sort((a, b) => Date.parse(b.paid_at) - Date.parse(a.paid_at));

  return (
    hasRecentMonthlyTierPayment(succeeded) ||
    hasActiveAnnualPrepaid(succeeded)
  );
}

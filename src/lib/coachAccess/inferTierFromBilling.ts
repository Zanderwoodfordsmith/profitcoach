import {
  buildPaymentBillingKindIndex,
  isRecurringSubscriptionAmount,
  resolvePaymentBillingKind,
  type PaymentForBillingKind,
} from "@/lib/paymentBillingKind";
import type { CoachRecurringPaymentStatus } from "@/lib/coachBilling";
import type { CoachAccessTier } from "@/lib/coachAccess/tiers";

const RECURRING_STALE_DAYS = 75;

export type BillingTierSuggestion = {
  suggestedTier: CoachAccessTier | null;
  reason: string;
  confidence: "high" | "medium" | "low";
};

function daysSince(iso: string): number {
  const ms = Date.now() - Date.parse(iso);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function statusSuggestsPro(
  status: CoachRecurringPaymentStatus | null | undefined
): boolean {
  if (!status) return false;
  return (
    status === "monthly" ||
    status === "first_6_months" ||
    status === "annual_prepaid" ||
    status === "complimentary"
  );
}

function hasRecentRecurringPayment(
  payments: PaymentForBillingKind[]
): boolean {
  const succeeded = payments
    .filter((p) => p.status === "succeeded")
    .sort(
      (a, b) => Date.parse(b.paid_at) - Date.parse(a.paid_at)
    );

  const kindIndex = buildPaymentBillingKindIndex(payments);

  for (const payment of succeeded) {
    if (daysSince(payment.paid_at) > RECURRING_STALE_DAYS) continue;

    const inferred = kindIndex.get(payment.id) ?? "other";
    const kind = resolvePaymentBillingKind(
      inferred,
      payment.billing_kind_override
    );
    if (kind === "recurring") return true;

    if (
      isRecurringSubscriptionAmount(
        payment.amount_cents,
        payment.currency
      )
    ) {
      return true;
    }
  }

  return false;
}

export function inferTierFromBilling(input: {
  recurringPaymentStatus: CoachRecurringPaymentStatus | null | undefined;
  payments: PaymentForBillingKind[];
}): BillingTierSuggestion {
  const { recurringPaymentStatus, payments } = input;

  if (recurringPaymentStatus === "overdue") {
    return {
      suggestedTier: null,
      reason: "Billing status is overdue — review manually.",
      confidence: "low",
    };
  }

  if (statusSuggestsPro(recurringPaymentStatus)) {
    return {
      suggestedTier: "pro",
      reason: `Billing status is ${recurringPaymentStatus}.`,
      confidence: "high",
    };
  }

  if (hasRecentRecurringPayment(payments)) {
    return {
      suggestedTier: "pro",
      reason: "Recent recurring-tier payment found.",
      confidence: "medium",
    };
  }

  if (payments.some((p) => p.status === "succeeded")) {
    return {
      suggestedTier: null,
      reason: "Payments found but none match active Pro billing — review manually.",
      confidence: "low",
    };
  }

  return {
    suggestedTier: null,
    reason: "No billing signals — assign tier manually.",
    confidence: "low",
  };
}

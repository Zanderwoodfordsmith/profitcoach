export type PaymentBillingKind = "recurring" | "initial" | "installment" | "other";

export const PAYMENT_BILLING_KINDS: PaymentBillingKind[] = [
  "recurring",
  "initial",
  "installment",
  "other",
];

export type PaymentForBillingKind = {
  id: string;
  customer_email: string;
  coach_id?: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  description: string | null;
  paid_at: string;
  billing_kind_override?: PaymentBillingKind | null;
};

function billingGroupKey(payment: PaymentForBillingKind): string {
  const coachId = payment.coach_id?.trim();
  if (coachId) {
    return `coach:${coachId}`;
  }
  return `email:${payment.customer_email.trim().toLowerCase()}`;
}

/** Standard monthly subscription tiers (minor units). */
const RECURRING_AMOUNT_CENTS: Record<string, Set<number>> = {
  gbp: new Set([49500, 99000, 39900, 79500, 95000]),
  usd: new Set([39900, 79500, 149900, 299900]),
};

/** Legacy BCA Stripe: $997 programme, £800 Elevate instalments. */
const PROGRAMME_AMOUNT_CENTS: Record<string, Set<number>> = {
  usd: new Set([99700]),
  gbp: new Set([80000]),
};

/** Annual upfront at 12× monthly tier. */
const ANNUAL_12_MONTH_AMOUNT_CENTS: Record<string, Set<number>> = {
  gbp: new Set([594000, 1188000, 478800, 954000]),
  usd: new Set([478800, 954000, 1798800, 3598800]),
};

/** Annual upfront at 10× monthly (common: £4,950 / £9,900). */
const ANNUAL_10_MONTH_AMOUNT_CENTS: Record<string, Set<number>> = {
  gbp: new Set([495000, 990000]),
  usd: new Set([399000, 795000, 1499000, 2999000]),
};

/**
 * Prior succeeded spend (same currency) above this → treat later payments as recurring
 * unless they look like a programme upfront or tier upgrade.
 */
const ESTABLISHED_CUSTOMER_PRIOR_TOTAL_CENTS: Record<string, number> = {
  gbp: 780_000,
  usd: 780_000,
};

/** ~£8k–£12k one-offs that are tier upgrades, not subscription renewals. */
const UPGRADE_AMOUNT_MIN_CENTS = 800_000;
const UPGRADE_AMOUNT_MAX_CENTS = 1_200_000;

function normalizeCurrency(currency: string): string {
  return currency.trim().toLowerCase();
}

function amountInSet(
  amountCents: number,
  currency: string,
  table: Record<string, Set<number>>
): boolean {
  return table[normalizeCurrency(currency)]?.has(amountCents) ?? false;
}

export function isRecurringSubscriptionAmount(
  amountCents: number,
  currency: string
): boolean {
  return amountInSet(amountCents, currency, RECURRING_AMOUNT_CENTS);
}

export function isAnnual12MonthSubscriptionAmount(
  amountCents: number,
  currency: string
): boolean {
  return amountInSet(amountCents, currency, ANNUAL_12_MONTH_AMOUNT_CENTS);
}

/** @deprecated Use isAnnual12MonthSubscriptionAmount */
export function isAnnualRecurringSubscriptionAmount(
  amountCents: number,
  currency: string
): boolean {
  return isAnnual12MonthSubscriptionAmount(amountCents, currency);
}

export function isAnnual10MonthSubscriptionAmount(
  amountCents: number,
  currency: string
): boolean {
  return amountInSet(amountCents, currency, ANNUAL_10_MONTH_AMOUNT_CENTS);
}

/** Monthly, 10-month annual, or 12-month annual tier amounts. */
export function isProgrammeUpfrontAmount(
  amountCents: number,
  currency: string
): boolean {
  return amountInSet(amountCents, currency, PROGRAMME_AMOUNT_CENTS);
}

export function isSubscriptionTierAmount(
  amountCents: number,
  currency: string
): boolean {
  return (
    isRecurringSubscriptionAmount(amountCents, currency) ||
    isAnnual12MonthSubscriptionAmount(amountCents, currency) ||
    isAnnual10MonthSubscriptionAmount(amountCents, currency) ||
    isProgrammeUpfrontAmount(amountCents, currency)
  );
}

/** @deprecated Use isSubscriptionTierAmount */
export function isRecurringOrAnnualSubscriptionAmount(
  amountCents: number,
  currency: string
): boolean {
  return isSubscriptionTierAmount(amountCents, currency);
}

export function establishedCustomerPriorTotalCents(currency: string): number {
  return (
    ESTABLISHED_CUSTOMER_PRIOR_TOTAL_CENTS[normalizeCurrency(currency)] ?? 780_000
  );
}

export function isEstablishedCustomer(
  priorSucceededTotalCents: number,
  currency: string
): boolean {
  return priorSucceededTotalCents >= establishedCustomerPriorTotalCents(currency);
}

/** Large one-off upgrade (e.g. ~£10k), not a subscription tier amount. */
export function isUpgradeAmount(amountCents: number, currency: string): boolean {
  if (isSubscriptionTierAmount(amountCents, currency)) {
    return false;
  }
  return (
    amountCents >= UPGRADE_AMOUNT_MIN_CENTS &&
    amountCents <= UPGRADE_AMOUNT_MAX_CENTS
  );
}

function descriptionFlags(description: string | null) {
  const text = (description ?? "").toLowerCase();
  return {
    subscriptionUpdate: /subscription\s+update/.test(text),
    subscriptionCreation: /subscription\s+creation/.test(text),
    annualHint:
      /\bannual\b/.test(text) ||
      /\byear\b/.test(text) ||
      /\b12\s*month/.test(text) ||
      /\b10\s*month/.test(text) ||
      /\bsummit\b/.test(text),
    upgradeHint: /\bupgrade\b/.test(text) || /\bmastermind\b/.test(text),
    programmeHint:
      /\bprogramme\b/.test(text) ||
      /\bprogram\b/.test(text) ||
      /\bintensive\b/.test(text) ||
      /\b6\s*week\b/.test(text) ||
      /\bcertification\b/.test(text) ||
      /\bthrivecart\b/.test(text),
  };
}

export function paymentBillingKindLabel(kind: PaymentBillingKind): string {
  switch (kind) {
    case "recurring":
      return "Recurring";
    case "initial":
      return "New";
    case "installment":
      return "Plan";
    default:
      return "—";
  }
}

export function paymentBillingKindBadgeClass(kind: PaymentBillingKind): string {
  switch (kind) {
    case "recurring":
      return "bg-sky-100 text-sky-800";
    case "initial":
      return "bg-violet-100 text-violet-800";
    case "installment":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function paymentBillingKindChartClass(kind: PaymentBillingKind): string {
  switch (kind) {
    case "recurring":
      return "bg-sky-500";
    case "initial":
      return "bg-violet-500";
    case "installment":
      return "bg-amber-500";
    default:
      return "bg-slate-400";
  }
}

export const PAYMENT_BILLING_CHART_STACK_ORDER: PaymentBillingKind[] = [
  "recurring",
  "initial",
  "installment",
  "other",
];

export function resolvePaymentBillingKind(
  inferred: PaymentBillingKind,
  override: PaymentBillingKind | null | undefined
): PaymentBillingKind {
  return override ?? inferred;
}

type ClassifyContext = {
  succeededIndex: number;
  /** Sum of earlier succeeded payments from this customer in the same currency. */
  priorSucceededTotalCents: number;
};

function classifySubscriptionTierPayment(
  payment: PaymentForBillingKind,
  ctx: ClassifyContext
): PaymentBillingKind {
  const { succeededIndex } = ctx;
  const annual12 = isAnnual12MonthSubscriptionAmount(
    payment.amount_cents,
    payment.currency
  );
  const annual10 = isAnnual10MonthSubscriptionAmount(
    payment.amount_cents,
    payment.currency
  );
  const { subscriptionUpdate, subscriptionCreation, annualHint } =
    descriptionFlags(payment.description);

  if (annual12 || annual10 || annualHint) {
    if (isEstablishedCustomer(ctx.priorSucceededTotalCents, payment.currency)) {
      return "recurring";
    }
    return succeededIndex === 0 && !subscriptionUpdate ? "initial" : "recurring";
  }

  if (subscriptionCreation || succeededIndex === 0) {
    if (
      isEstablishedCustomer(ctx.priorSucceededTotalCents, payment.currency) ||
      (subscriptionUpdate && succeededIndex > 0)
    ) {
      return "recurring";
    }
    return "initial";
  }

  if (subscriptionUpdate || succeededIndex > 0) {
    return "recurring";
  }

  return "initial";
}

function classifyEstablishedCustomerPayment(
  payment: PaymentForBillingKind,
  ctx: ClassifyContext
): PaymentBillingKind {
  const { upgradeHint, programmeHint } = descriptionFlags(payment.description);

  if (isUpgradeAmount(payment.amount_cents, payment.currency) || upgradeHint) {
    return "initial";
  }

  if (isSubscriptionTierAmount(payment.amount_cents, payment.currency)) {
    return classifySubscriptionTierPayment(payment, ctx);
  }

  if (programmeHint && ctx.succeededIndex === 0) {
    return "initial";
  }

  return "recurring";
}

function classifySucceededPayment(
  payment: PaymentForBillingKind,
  ctx: ClassifyContext
): PaymentBillingKind {
  if (isUpgradeAmount(payment.amount_cents, payment.currency)) {
    return "initial";
  }

  if (isEstablishedCustomer(ctx.priorSucceededTotalCents, payment.currency)) {
    return classifyEstablishedCustomerPayment(payment, ctx);
  }

  if (isSubscriptionTierAmount(payment.amount_cents, payment.currency)) {
    return classifySubscriptionTierPayment(payment, ctx);
  }

  const { programmeHint } = descriptionFlags(payment.description);
  if (ctx.succeededIndex === 0 || programmeHint) {
    return "initial";
  }

  return "installment";
}

/**
 * Classify payments chronologically per assigned coach (when set), otherwise per email.
 * Respects billing_kind_override when set.
 */
export function buildPaymentBillingKindIndex(
  payments: PaymentForBillingKind[]
): Map<string, PaymentBillingKind> {
  const byGroup = new Map<string, PaymentForBillingKind[]>();

  for (const payment of payments) {
    const key = billingGroupKey(payment);
    const list = byGroup.get(key) ?? [];
    list.push(payment);
    byGroup.set(key, list);
  }

  const inferredIndex = new Map<string, PaymentBillingKind>();

  for (const groupPayments of byGroup.values()) {
    const succeeded = [...groupPayments]
      .filter((payment) => payment.status === "succeeded")
      .sort((a, b) => Date.parse(a.paid_at) - Date.parse(b.paid_at));

    const runningTotalByCurrency = new Map<string, number>();

    for (const payment of succeeded) {
      const currency = normalizeCurrency(payment.currency);
      const priorTotal = runningTotalByCurrency.get(currency) ?? 0;
      const succeededIndex = succeeded.findIndex((row) => row.id === payment.id);

      inferredIndex.set(
        payment.id,
        classifySucceededPayment(payment, {
          succeededIndex: Math.max(0, succeededIndex),
          priorSucceededTotalCents: priorTotal,
        })
      );

      runningTotalByCurrency.set(
        currency,
        priorTotal + payment.amount_cents
      );
    }

    for (const payment of groupPayments) {
      if (payment.status !== "succeeded") {
        inferredIndex.set(payment.id, "other");
      }
    }
  }

  const resolved = new Map<string, PaymentBillingKind>();
  for (const payment of payments) {
    const inferred = inferredIndex.get(payment.id) ?? "other";
    resolved.set(
      payment.id,
      resolvePaymentBillingKind(inferred, payment.billing_kind_override)
    );
  }

  return resolved;
}

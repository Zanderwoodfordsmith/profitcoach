import { programmeJoinCheckoutHref } from "@/config/programmeJoin";

/**
 * Closer-sent join offers — same Business Coach Academy product, different prices.
 * Closers send the matching link; checkout does not offer a plan switcher.
 *
 * Defaults are low-amount test prices so checkout still loads in dev.
 * Override with env for live amounts (summary copy should match the Stripe price):
 *   STRIPE_PRICE_PROGRAMME_JOIN_PAY_IN_FULL=…
 *   STRIPE_PRICE_PROGRAMME_JOIN_TWO_PAY=…
 *   STRIPE_PRICE_PROGRAMME_JOIN_THREE_PAY=…
 */
export const PROGRAMME_JOIN_PAY_IN_FULL_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_PAY_IN_FULL?.trim() ||
  "price_1U3dpLEz5QxIrr4nXgYZExea"; // £2 test

export const PROGRAMME_JOIN_TWO_PAY_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_TWO_PAY?.trim() ||
  "price_1U3cjcEz5QxIrr4nhVqo5Jrf"; // £1 × 2 test

/** Live 3-pay: £3,300 × 3 (override with env if needed). */
export const PROGRAMME_JOIN_THREE_PAY_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_THREE_PAY?.trim() ||
  "price_1U3cIJEz5QxIrr4nvBEfLVgK";

export type ProgrammeJoinOfferSlug = "pay-in-full" | "two-pay" | "three-pay";

export type ProgrammeJoinOffer = {
  slug: ProgrammeJoinOfferSlug;
  priceId: string;
  title: string;
  headline: string;
  amountLabel: string;
  /** Per-installment / today amount shown in order summary. */
  todayAmountLabel: string;
  totalLabel: string;
  /** Total number of charges (1 = pay in full). */
  paymentCount: number;
  /**
   * ThriveCart-style detail under “Future payments”, e.g.
   * "2× payments, due monthly". Null when paymentCount === 1.
   */
  futurePaymentsDetail: string | null;
  /** Short schedule line under the line items. */
  scheduleNote: string;
  /** Primary pay button copy when using custom Elements. */
  ctaLabel: string;
  bullets: string[];
  /** Shown beside Stripe’s pay button inside hosted/embedded Checkout. */
  checkoutSubmitMessage: string;
};

export const PROGRAMME_JOIN_OFFERS: Record<
  ProgrammeJoinOfferSlug,
  ProgrammeJoinOffer
> = {
  "pay-in-full": {
    slug: "pay-in-full",
    priceId: PROGRAMME_JOIN_PAY_IN_FULL_PRICE_ID,
    title: "Pay in full",
    headline: "Business Coach Academy",
    amountLabel: "£2 pay in full",
    todayAmountLabel: "£2",
    totalLabel: "One payment today",
    paymentCount: 1,
    futurePaymentsDetail: null,
    scheduleNote: "Access starts after checkout.",
    ctaLabel: "Pay £2 today",
    bullets: [
      "Pay £2 once today (test)",
      "Full programme access after checkout",
      "Orientation booking on the next screen",
    ],
    checkoutSubmitMessage:
      "You’re paying £2 once today for Business Coach Academy (test).",
  },
  "two-pay": {
    slug: "two-pay",
    priceId: PROGRAMME_JOIN_TWO_PAY_PRICE_ID,
    title: "2-pay plan",
    headline: "Business Coach Academy",
    amountLabel: "2 × £1",
    todayAmountLabel: "£1",
    totalLabel: "Total £2",
    paymentCount: 2,
    futurePaymentsDetail: "1× payment, due in 1 month",
    scheduleNote: "Only two payments — then it stops.",
    ctaLabel: "Pay 2 × £1",
    bullets: [
      "£1 today, then £1 in one month",
      "Only two payments — then it stops",
      "Full programme access after the first payment",
    ],
    checkoutSubmitMessage:
      "2-pay plan: £1 today, then £1 in one month — only two payments, then it stops.",
  },
  "three-pay": {
    slug: "three-pay",
    priceId: PROGRAMME_JOIN_THREE_PAY_PRICE_ID,
    title: "3-pay plan",
    headline: "Business Coach Academy",
    amountLabel: "3 × £3,300",
    todayAmountLabel: "£3,300",
    totalLabel: "Total £9,900",
    paymentCount: 3,
    futurePaymentsDetail: "2× payments, due monthly",
    scheduleNote: "Only three payments — then it stops. Total £9,900.",
    ctaLabel: "Pay 3 × £3,300",
    bullets: [
      "£3,300 today, then £3,300 for two more months",
      "Only three payments — then it stops",
      "Full programme access after the first payment",
    ],
    checkoutSubmitMessage:
      "3-pay plan: £3,300 today, then £3,300 monthly for two more payments — only three payments, then it stops.",
  },
};

export function isProgrammeJoinOfferSlug(
  value: unknown
): value is ProgrammeJoinOfferSlug {
  return value === "pay-in-full" || value === "two-pay" || value === "three-pay";
}

/** @deprecated Prefer offer pages; kept for direct API links. */
export function programmeJoinOfferCheckoutHref(
  slug: ProgrammeJoinOfferSlug
): string {
  return programmeJoinCheckoutHref(PROGRAMME_JOIN_OFFERS[slug].priceId);
}

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
 *   STRIPE_PRICE_PROGRAMME_JOIN_THREE_PAY_1=…
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

/** Test 3-pay: £1 × 3. */
export const PROGRAMME_JOIN_THREE_PAY_1_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_THREE_PAY_1?.trim() ||
  "price_1U3sfWEz5QxIrr4nmOhbEowQ";

export type ProgrammeJoinOfferSlug =
  | "pay-in-full"
  | "two-pay"
  | "three-pay"
  | "three-pay-1";

export type ProgrammeJoinOffer = {
  slug: ProgrammeJoinOfferSlug;
  priceId: string;
  title: string;
  headline: string;
  amountLabel: string;
  /** Per-installment / today amount shown in order summary. */
  todayAmountLabel: string;
  /** Right-hand amount for future payments (remaining installments). */
  futureAmountLabel: string | null;
  /** Grand total on the right, e.g. "£9,900". */
  totalAmountLabel: string;
  totalLabel: string;
  /** Total number of charges (1 = pay in full). */
  paymentCount: number;
  /**
   * Under “Future payments”, e.g. "2 × £3,300 due monthly".
   * Null when paymentCount === 1.
   */
  futurePaymentsDetail: string | null;
  /** @deprecated Summary now uses totalAmountLabel instead. */
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
    futureAmountLabel: null,
    totalAmountLabel: "£2",
    totalLabel: "One payment today",
    paymentCount: 1,
    futurePaymentsDetail: null,
    scheduleNote: "",
    ctaLabel: "Complete order",
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
    futureAmountLabel: "£1",
    totalAmountLabel: "£2",
    totalLabel: "Total £2",
    paymentCount: 2,
    futurePaymentsDetail: "1 × £1 due in 1 month",
    scheduleNote: "",
    ctaLabel: "Complete order",
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
    futureAmountLabel: "£6,600",
    totalAmountLabel: "£9,900",
    totalLabel: "Total £9,900",
    paymentCount: 3,
    futurePaymentsDetail: "2 × £3,300 due monthly",
    scheduleNote: "",
    ctaLabel: "Complete order",
    bullets: [
      "£3,300 today, then £3,300 for two more months",
      "Only three payments — then it stops",
      "Full programme access after the first payment",
    ],
    checkoutSubmitMessage:
      "3-pay plan: £3,300 today, then £3,300 monthly for two more payments — only three payments, then it stops.",
  },
  "three-pay-1": {
    slug: "three-pay-1",
    priceId: PROGRAMME_JOIN_THREE_PAY_1_PRICE_ID,
    title: "3-pay plan",
    headline: "Business Coach Academy",
    amountLabel: "3 × £1",
    todayAmountLabel: "£1",
    futureAmountLabel: "£2",
    totalAmountLabel: "£3",
    totalLabel: "Total £3",
    paymentCount: 3,
    futurePaymentsDetail: "2 × £1 due monthly",
    scheduleNote: "",
    ctaLabel: "Complete order",
    bullets: [
      "£1 today, then £1 for two more months",
      "Only three payments — then it stops",
      "Full programme access after the first payment",
    ],
    checkoutSubmitMessage:
      "3-pay plan: £1 today, then £1 monthly for two more payments — only three payments, then it stops.",
  },
};

export function isProgrammeJoinOfferSlug(
  value: unknown
): value is ProgrammeJoinOfferSlug {
  return typeof value === "string" && value in PROGRAMME_JOIN_OFFERS;
}

/** @deprecated Prefer offer pages; kept for direct API links. */
export function programmeJoinOfferCheckoutHref(
  slug: ProgrammeJoinOfferSlug
): string {
  return programmeJoinCheckoutHref(PROGRAMME_JOIN_OFFERS[slug].priceId);
}

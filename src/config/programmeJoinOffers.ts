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
 *   STRIPE_PRICE_PROGRAMME_JOIN_PAY_IN_FULL_9900=…
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

/** Live pay in full: £9,900 once. */
export const PROGRAMME_JOIN_PAY_IN_FULL_9900_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_PAY_IN_FULL_9900?.trim() ||
  "price_1U3cwtEz5QxIrr4nnXcbZyTs";

export const PROGRAMME_JOIN_TWO_PAY_4950_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_TWO_PAY_4950?.trim() ||
  "price_1U3cwtEz5QxIrr4niWPgqHVY";

export const PROGRAMME_JOIN_FOUR_PAY_2600_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_FOUR_PAY_2600?.trim() ||
  "price_1U3cIKEz5QxIrr4nAou16X2g";

export const PROGRAMME_JOIN_SIX_PAY_1750_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_SIX_PAY_1750?.trim() ||
  "price_1U3cIKEz5QxIrr4nhfmYCWX3";

export const PROGRAMME_JOIN_PAY_IN_FULL_12900_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_PAY_IN_FULL_12900?.trim() ||
  "price_1U3cIKEz5QxIrr4nEIvGEYWD";

export const PROGRAMME_JOIN_TWO_PAY_6450_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_TWO_PAY_6450?.trim() ||
  "price_1U3cILEz5QxIrr4npV4mggXT";

export const PROGRAMME_JOIN_THREE_PAY_4300_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_THREE_PAY_4300?.trim() ||
  "price_1U3cILEz5QxIrr4ntLjHBqYe";

export const PROGRAMME_JOIN_FOUR_PAY_3400_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_FOUR_PAY_3400?.trim() ||
  "price_1U3cILEz5QxIrr4nnHTeDQP3";

export const PROGRAMME_JOIN_SIX_PAY_2300_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN_SIX_PAY_2300?.trim() ||
  "price_1U3cIMEz5QxIrr4nBXNHDxHU";

export type ProgrammeJoinOfferSlug =
  | "pay-in-full"
  | "two-pay"
  | "three-pay"
  | "three-pay-1"
  | "pay-in-full-9900"
  | "two-pay-4950"
  | "four-pay-2600"
  | "six-pay-1750"
  | "pay-in-full-12900"
  | "two-pay-6450"
  | "three-pay-4300"
  | "four-pay-3400"
  | "six-pay-2300";

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
  /** Prefills the checkout country selector. */
  defaultCountry?: "GB" | "US";
};

const COUNT_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
};

function money(amount: number, currency: "gbp" | "usd"): string {
  const symbol = currency === "gbp" ? "£" : "$";
  return `${symbol}${amount.toLocaleString("en-GB")}`;
}

function liveOffer(input: {
  slug: ProgrammeJoinOfferSlug;
  priceId: string;
  currency: "gbp" | "usd";
  installmentAmount: number;
  paymentCount: number;
  totalAmount: number;
}): ProgrammeJoinOffer {
  const unit = money(input.installmentAmount, input.currency);
  const total = money(input.totalAmount, input.currency);
  const remaining = input.paymentCount - 1;
  const remainingTotal = money(input.installmentAmount * remaining, input.currency);
  const countWord = COUNT_WORDS[input.paymentCount] ?? String(input.paymentCount);
  const remainingWord = COUNT_WORDS[remaining] ?? String(remaining);
  const defaultCountry = input.currency === "usd" ? "US" : "GB";

  if (input.paymentCount === 1) {
    return {
      slug: input.slug,
      priceId: input.priceId,
      title: "Pay in full",
      headline: "Business Coach Academy",
      amountLabel: unit,
      todayAmountLabel: unit,
      futureAmountLabel: null,
      totalAmountLabel: total,
      totalLabel: "One payment today",
      paymentCount: 1,
      futurePaymentsDetail: null,
      scheduleNote: "",
      ctaLabel: "Complete order",
      bullets: [
        `Pay ${unit} once today`,
        "Full programme access after checkout",
        "Orientation booking on the next screen",
      ],
      checkoutSubmitMessage: `You’re paying ${unit} once today for Business Coach Academy.`,
      defaultCountry,
    };
  }

  const futurePaymentsDetail =
    remaining === 1
      ? `1 × ${unit} due in 1 month`
      : `${remaining} × ${unit} due monthly`;
  const thenPhrase =
    remaining === 1
      ? `then ${unit} in one month`
      : `then ${unit} for ${remainingWord} more months`;
  const submitThen =
    remaining === 1
      ? `then ${unit} in one month`
      : `then ${unit} monthly for ${remainingWord} more payments`;

  return {
    slug: input.slug,
    priceId: input.priceId,
    title: `${input.paymentCount}-pay plan`,
    headline: "Business Coach Academy",
    amountLabel: `${input.paymentCount} × ${unit}`,
    todayAmountLabel: unit,
    futureAmountLabel: remainingTotal,
    totalAmountLabel: total,
    totalLabel: `Total ${total}`,
    paymentCount: input.paymentCount,
    futurePaymentsDetail,
    scheduleNote: "",
    ctaLabel: "Complete order",
    bullets: [
      `${unit} today, ${thenPhrase}`,
      `Only ${countWord} payments — then it stops`,
      "Full programme access after the first payment",
    ],
    checkoutSubmitMessage: `${input.paymentCount}-pay plan: ${unit} today, ${submitThen} — only ${countWord} payments, then it stops.`,
    defaultCountry,
  };
}

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
  "three-pay": liveOffer({
    slug: "three-pay",
    priceId: PROGRAMME_JOIN_THREE_PAY_PRICE_ID,
    currency: "gbp",
    installmentAmount: 3300,
    paymentCount: 3,
    totalAmount: 9900,
  }),
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
  "pay-in-full-9900": liveOffer({
    slug: "pay-in-full-9900",
    priceId: PROGRAMME_JOIN_PAY_IN_FULL_9900_PRICE_ID,
    currency: "gbp",
    installmentAmount: 9900,
    paymentCount: 1,
    totalAmount: 9900,
  }),
  "two-pay-4950": liveOffer({
    slug: "two-pay-4950",
    priceId: PROGRAMME_JOIN_TWO_PAY_4950_PRICE_ID,
    currency: "gbp",
    installmentAmount: 4950,
    paymentCount: 2,
    totalAmount: 9900,
  }),
  "four-pay-2600": liveOffer({
    slug: "four-pay-2600",
    priceId: PROGRAMME_JOIN_FOUR_PAY_2600_PRICE_ID,
    currency: "gbp",
    installmentAmount: 2600,
    paymentCount: 4,
    totalAmount: 10400,
  }),
  "six-pay-1750": liveOffer({
    slug: "six-pay-1750",
    priceId: PROGRAMME_JOIN_SIX_PAY_1750_PRICE_ID,
    currency: "gbp",
    installmentAmount: 1750,
    paymentCount: 6,
    totalAmount: 10500,
  }),
  "pay-in-full-12900": liveOffer({
    slug: "pay-in-full-12900",
    priceId: PROGRAMME_JOIN_PAY_IN_FULL_12900_PRICE_ID,
    currency: "usd",
    installmentAmount: 12900,
    paymentCount: 1,
    totalAmount: 12900,
  }),
  "two-pay-6450": liveOffer({
    slug: "two-pay-6450",
    priceId: PROGRAMME_JOIN_TWO_PAY_6450_PRICE_ID,
    currency: "usd",
    installmentAmount: 6450,
    paymentCount: 2,
    totalAmount: 12900,
  }),
  "three-pay-4300": liveOffer({
    slug: "three-pay-4300",
    priceId: PROGRAMME_JOIN_THREE_PAY_4300_PRICE_ID,
    currency: "usd",
    installmentAmount: 4300,
    paymentCount: 3,
    totalAmount: 12900,
  }),
  "four-pay-3400": liveOffer({
    slug: "four-pay-3400",
    priceId: PROGRAMME_JOIN_FOUR_PAY_3400_PRICE_ID,
    currency: "usd",
    installmentAmount: 3400,
    paymentCount: 4,
    totalAmount: 13600,
  }),
  "six-pay-2300": liveOffer({
    slug: "six-pay-2300",
    priceId: PROGRAMME_JOIN_SIX_PAY_2300_PRICE_ID,
    currency: "usd",
    installmentAmount: 2300,
    paymentCount: 6,
    totalAmount: 13800,
  }),
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

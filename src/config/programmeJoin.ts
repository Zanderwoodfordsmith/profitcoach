import { stripeServer } from "@/lib/stripeServer";

/**
 * Programme join Checkout — used for BCA enrolment.
 * Supports:
 * - one-time prices on the default programme product
 * - recurring prices with metadata `programme_join_payments` (e.g. "2")
 *   on the default product OR any product tagged `metadata.product=programme_join`
 *
 * Closer-facing plan copy lives on /join/pay-in-full and /join/two-pay.
 * Product: Business Coach Academy (prod_V3fJctbqpWxz9N).
 */
export const PROGRAMME_JOIN_PRODUCT_ID =
  process.env.STRIPE_PRODUCT_PROGRAMME_JOIN?.trim() || "prod_V3fJctbqpWxz9N";

/** Default price when /join or /api/join/checkout is opened with no ?price= */
export const PROGRAMME_JOIN_DEFAULT_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN?.trim() ||
  "price_1U3XyzEz5QxIrr4nB7msL5nf";

/** @deprecated Prefer PROGRAMME_JOIN_TWO_PAY_PRICE_ID in programmeJoinOffers. */
export const PROGRAMME_JOIN_TWO_PAY_TEST_PRICE_ID =
  "price_1U3cjcEz5QxIrr4nhVqo5Jrf";

/** @deprecated Prefer /join/two-pay for closer links. */
export const PROGRAMME_JOIN_TWO_PAY_TEST_PAYMENT_LINK =
  "https://buy.stripe.com/dRm8wPfcDdPsa588WucZa0a";

export function programmeJoinCheckoutHref(priceId?: string | null): string {
  const params = new URLSearchParams();
  if (priceId?.trim()) params.set("price", priceId.trim());
  const qs = params.toString();
  return qs ? `/api/join/checkout?${qs}` : "/api/join/checkout";
}

export function programmeJoinPaymentCount(
  metadata: Record<string, string> | null | undefined
): number | null {
  const raw = metadata?.programme_join_payments?.trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 36) return null;
  return n;
}

/** Approximate interval length for scheduling cancel_at after N charges. */
export function recurringIntervalSeconds(
  interval: string,
  intervalCount: number
): number {
  const count = Math.max(1, intervalCount || 1);
  const day = 24 * 60 * 60;
  switch (interval) {
    case "day":
      return day * count;
    case "week":
      return 7 * day * count;
    case "month":
      // Calendar months vary; pad slightly so the Nth invoice still fires.
      return 31 * day * count;
    case "year":
      return 366 * day * count;
    default:
      return 31 * day * count;
  }
}

/**
 * Resolve a join price: active one-time, or recurring with programme_join_payments,
 * on the programme product.
 */
export async function resolveProgrammeJoinPriceId(
  requestedPriceId?: string | null
): Promise<{ priceId: string } | { error: string; status: number }> {
  const priceId = (requestedPriceId?.trim() || PROGRAMME_JOIN_DEFAULT_PRICE_ID).trim();
  if (!priceId.startsWith("price_")) {
    return { error: "Invalid price id.", status: 400 };
  }

  try {
    const price = await stripeServer.prices.retrieve(priceId);
    const productId =
      typeof price.product === "string" ? price.product : price.product?.id;

    if (!price.active) {
      return { error: "That price is not active.", status: 400 };
    }

    const taggedProgrammeJoin = price.metadata?.product === "programme_join";
    if (productId !== PROGRAMME_JOIN_PRODUCT_ID && !taggedProgrammeJoin) {
      return {
        error: "That price does not belong to the programme join product.",
        status: 400,
      };
    }

    if (price.type === "one_time") {
      return { priceId: price.id };
    }

    if (price.type === "recurring") {
      const payments = programmeJoinPaymentCount(price.metadata);
      if (!payments) {
        return {
          error:
            "Recurring programme prices need metadata programme_join_payments (e.g. 2).",
          status: 400,
        };
      }
      return { priceId: price.id };
    }

    return {
      error: "Unsupported price type for programme join.",
      status: 400,
    };
  } catch (error) {
    console.error("resolveProgrammeJoinPriceId:", error);
    return { error: "Could not load that Stripe price.", status: 400 };
  }
}

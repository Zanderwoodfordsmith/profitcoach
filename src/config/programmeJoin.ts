import { stripeServer } from "@/lib/stripeServer";

/**
 * Programme join (one-time Stripe Checkout) — used for BCA enrolment.
 * Any active one-time price on this product is allowed.
 * Test product: Business Coach Academy (prod_V3fJctbqpWxz9N).
 */
export const PROGRAMME_JOIN_PRODUCT_ID =
  process.env.STRIPE_PRODUCT_PROGRAMME_JOIN?.trim() || "prod_V3fJctbqpWxz9N";

/** Default price when /join or /api/join/checkout is opened with no ?price= */
export const PROGRAMME_JOIN_DEFAULT_PRICE_ID =
  process.env.STRIPE_PRICE_PROGRAMME_JOIN?.trim() ||
  "price_1U3XyzEz5QxIrr4nB7msL5nf";

export function programmeJoinCheckoutHref(priceId?: string | null): string {
  const params = new URLSearchParams();
  if (priceId?.trim()) params.set("price", priceId.trim());
  const qs = params.toString();
  return qs ? `/api/join/checkout?${qs}` : "/api/join/checkout";
}

/**
 * Resolve a join price: must be an active one-time price on the programme product.
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
    if (price.type !== "one_time") {
      return {
        error: "Programme join only supports one-time prices on this product.",
        status: 400,
      };
    }
    if (productId !== PROGRAMME_JOIN_PRODUCT_ID) {
      return {
        error: "That price does not belong to the programme join product.",
        status: 400,
      };
    }

    return { priceId: price.id };
  } catch (error) {
    console.error("resolveProgrammeJoinPriceId:", error);
    return { error: "Could not load that Stripe price.", status: 400 };
  }
}

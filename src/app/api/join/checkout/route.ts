import { NextResponse } from "next/server";

import { resolveProgrammeJoinPriceId } from "@/config/programmeJoin";

/**
 * GET /api/join/checkout
 * GET /api/join/checkout?price=price_xxx
 *
 * Starts Stripe Checkout for a programme price (one-time or limited multi-pay),
 * then returns to /welcome for account + auto sign-in.
 */
export async function GET(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const resolved = await resolveProgrammeJoinPriceId(searchParams.get("price"));

  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  try {
    const { createGuestProgrammeJoinCheckoutSession } = await import(
      "@/lib/membership/checkout"
    );
    const result = await createGuestProgrammeJoinCheckoutSession({
      priceId: resolved.priceId,
      request,
      uiMode: "hosted",
    });
    if (!("url" in result)) {
      return NextResponse.json(
        { error: "Hosted checkout did not return a URL." },
        { status: 500 }
      );
    }
    return NextResponse.redirect(result.url, 303);
  } catch (error) {
    console.error("programme join checkout error:", error);
    const detail =
      error instanceof Error ? error.message : "Could not start checkout.";
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? detail
            : "Could not start checkout.",
      },
      { status: 500 }
    );
  }
}

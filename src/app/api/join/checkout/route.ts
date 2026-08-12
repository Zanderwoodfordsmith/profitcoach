import { NextResponse } from "next/server";

import { resolveProgrammeJoinPriceId } from "@/config/programmeJoin";

/**
 * GET /api/join/checkout
 * GET /api/join/checkout?price=price_xxx
 *
 * Starts one-time Stripe Checkout for any active price on the programme product,
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
    });
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

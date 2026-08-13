import { NextResponse } from "next/server";

import { resolveProgrammeJoinPriceId } from "@/config/programmeJoin";
import { PROGRAMME_JOIN_OFFERS } from "@/config/programmeJoinOffers";

/**
 * POST /api/join/checkout/elements
 * Body: { offer: "two-pay" | "pay-in-full" }
 *
 * Creates a Checkout Session with ui_mode=elements.
 * Email/name are collected in the client form and passed to checkout.confirm() —
 * do not set customer_email on the session (confirm would reject updating it).
 */
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const offerSlug =
    record.offer === "pay-in-full" || record.offer === "two-pay"
      ? record.offer
      : null;

  if (!offerSlug) {
    return NextResponse.json(
      { error: "offer must be pay-in-full or two-pay." },
      { status: 400 }
    );
  }

  const offer = PROGRAMME_JOIN_OFFERS[offerSlug];
  const resolved = await resolveProgrammeJoinPriceId(offer.priceId);
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
      uiMode: "elements",
    });
    if (!("clientSecret" in result)) {
      return NextResponse.json(
        { error: "Elements checkout did not return a client secret." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      clientSecret: result.clientSecret,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error("programme join elements checkout error:", error);
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

import { NextResponse } from "next/server";

import { resolveProgrammeJoinPriceId } from "@/config/programmeJoin";
import {
  PROGRAMME_JOIN_OFFERS,
  isProgrammeJoinOfferSlug,
} from "@/config/programmeJoinOffers";

/**
 * POST /api/join/checkout/embedded
 * Body: { offer: ProgrammeJoinOfferSlug } or { price: "price_xxx" }
 *
 * Creates an embedded Checkout Session and returns { clientSecret }.
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

  let priceId: string | null = null;
  let customSubmitMessage: string | undefined;

  if (isProgrammeJoinOfferSlug(record.offer)) {
    const offer = PROGRAMME_JOIN_OFFERS[record.offer];
    priceId = offer.priceId;
    customSubmitMessage = offer.checkoutSubmitMessage;
  } else if (typeof record.price === "string") {
    priceId = record.price;
  }

  const resolved = await resolveProgrammeJoinPriceId(priceId);
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
      uiMode: "embedded",
      customSubmitMessage,
    });
    if (!("clientSecret" in result)) {
      return NextResponse.json(
        { error: "Embedded checkout did not return a client secret." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      clientSecret: result.clientSecret,
      priceId: resolved.priceId,
      priceNickname: resolved.nickname,
    });
  } catch (error) {
    console.error("programme join embedded checkout error:", error);
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

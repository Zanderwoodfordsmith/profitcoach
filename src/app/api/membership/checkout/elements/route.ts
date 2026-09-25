import { NextResponse } from "next/server";

import {
  MEMBERSHIP_OFFERS,
  isMembershipOfferSlug,
} from "@/config/membershipOffers";

/**
 * POST /api/membership/checkout/elements
 * Body: { offer: MembershipOfferSlug }
 *
 * Creates a subscription Checkout Session with ui_mode=elements for the
 * /membership/* checkout pages.
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

  if (!isMembershipOfferSlug(record.offer)) {
    return NextResponse.json(
      { error: "Unknown membership offer." },
      { status: 400 }
    );
  }

  const offer = MEMBERSHIP_OFFERS[record.offer];
  if (!offer.priceId) {
    return NextResponse.json(
      { error: "Stripe price is not configured for this membership." },
      { status: 503 }
    );
  }

  try {
    const { stripeServer } = await import("@/lib/stripeServer");
    const price = await stripeServer.prices.retrieve(offer.priceId);
    if (!price.active || price.type !== "recurring") {
      return NextResponse.json(
        { error: "That membership price is not available." },
        { status: 400 }
      );
    }

    const { createGuestMembershipElementsCheckoutSession } = await import(
      "@/lib/membership/checkout"
    );
    const result = await createGuestMembershipElementsCheckoutSession({
      priceId: price.id,
      planKey: offer.planKey,
      offerSlug: offer.slug,
      request,
    });

    return NextResponse.json({
      clientSecret: result.clientSecret,
      sessionId: result.sessionId,
      priceId: price.id,
      priceNickname: price.nickname,
    });
  } catch (error) {
    console.error("membership elements checkout error:", error);
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

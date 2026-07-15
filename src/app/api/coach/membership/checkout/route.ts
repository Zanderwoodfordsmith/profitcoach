import { NextResponse } from "next/server";

import {
  MEMBERSHIP_PLANS,
  type MembershipInterval,
  type MembershipPlanKey,
  stripePriceIdForPlan,
} from "@/config/membershipPlans";

/**
 * GET /api/coach/membership/checkout?plan=core|premium|vip&interval=month|year
 * Redirects to Stripe Checkout for the configured price ID.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planKey = searchParams.get("plan") as MembershipPlanKey | null;
  const interval = (searchParams.get("interval") ?? "month") as MembershipInterval;

  if (!planKey || !(planKey in MEMBERSHIP_PLANS)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  if (interval !== "month" && interval !== "year") {
    return NextResponse.json({ error: "Invalid interval." }, { status: 400 });
  }

  const priceId = stripePriceIdForPlan(planKey, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price is not configured for this plan." },
      { status: 503 }
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 }
    );
  }

  const {
    createGuestMembershipCheckoutSession,
    createMembershipCheckoutSession,
  } = await import("@/lib/membership/checkout");
  const { requireCoachRequest } = await import("@/lib/requireCoachRequest");
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");

  const auth = await requireCoachRequest(request);

  if (!auth.error) {
    const { data: coachRow } = await supabaseAdmin
      .from("coaches")
      .select("access_tier")
      .eq("id", auth.userId)
      .maybeSingle();

    if (coachRow?.access_tier === "do_not_contact") {
      return NextResponse.json(
        { error: "Membership checkout is not available for this account." },
        { status: 403 }
      );
    }
  }

  try {
    const result = auth.error
      ? await createGuestMembershipCheckoutSession({
          priceId,
          planKey,
          request,
        })
      : await createMembershipCheckoutSession({
          coachId: auth.userId,
          priceId,
          request,
        });

    return NextResponse.redirect(result.url, 303);
  } catch (error) {
    console.error("membership checkout redirect error:", error);
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

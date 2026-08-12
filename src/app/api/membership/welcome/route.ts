import { NextResponse } from "next/server";

import { START_HERE_WELCOME_PATH } from "@/lib/academy/classroomIds";
import { provisionCoachFromCheckoutSession } from "@/lib/membership/provisionFromCheckout";

export const runtime = "nodejs";

/**
 * POST { session_id }
 * Verifies a paid Stripe Checkout Session, provisions the coach account if needed,
 * and returns a one-time token hash so the client can sign in immediately.
 */
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 }
    );
  }

  let body: { session_id?: string };
  try {
    body = (await request.json()) as { session_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json(
      { error: "A valid Stripe Checkout session_id is required." },
      { status: 400 }
    );
  }

  try {
    const result = await provisionCoachFromCheckoutSession({
      sessionId,
      includeLoginToken: true,
    });

    return NextResponse.json({
      ok: true,
      email: result.email,
      fullName: result.fullName,
      slug: result.slug,
      createdAccount: result.createdAccount,
      tokenHash: result.tokenHash,
      // Start Here — first welcome lesson, not First Campaign.
      continuePath: START_HERE_WELCOME_PATH,
    });
  } catch (error) {
    console.error("membership welcome error:", error);
    const message =
      error instanceof Error ? error.message : "Unable to complete signup.";
    const status =
      message.includes("not complete") || message.includes("no customer email")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

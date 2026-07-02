import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 }
    );
  }

  const { createMembershipPortalSession } = await import(
    "@/lib/membership/checkout"
  );

  try {
    const result = await createMembershipPortalSession({
      coachId: auth.userId,
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("membership portal error:", error);
    return NextResponse.json(
      { error: "Could not open billing portal." },
      { status: 500 }
    );
  }
}

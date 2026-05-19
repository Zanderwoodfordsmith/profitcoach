import { NextResponse } from "next/server";

import { backfillStripePayments } from "@/lib/backfillStripePayments";
import { requireAdmin } from "@/lib/requireAdmin";
import { stripeServer } from "@/lib/stripeServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 300;

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY is not configured on this server." },
      { status: 500 }
    );
  }

  try {
    const result = await backfillStripePayments(supabaseAdmin, stripeServer, {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("admin/payments/backfill POST:", error);
    const message = (error as Error).message;
    if (message.includes("coach_payments") || message.includes("relation")) {
      return NextResponse.json(
        {
          error:
            "Unable to write payments. Ensure the coach_payments migration has been applied to this database.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Stripe import failed." }, { status: 500 });
  }
}

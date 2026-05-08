import { NextResponse } from "next/server";
import Stripe from "stripe";

import { loadCoachDirectory, upsertCoachPaymentFromStripe } from "@/lib/stripePaymentsSync";
import { stripeServer } from "@/lib/stripeServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function coalesceEmail(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) return trimmed;
  }
  return null;
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook env is not configured." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = stripeServer.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const directory = await loadCoachDirectory(supabaseAdmin);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = coalesceEmail(
          session.customer_details?.email,
          session.customer_email
        );
        if (!customerEmail) break;
        const amountCents = session.amount_total ?? 0;
        if (!amountCents || amountCents <= 0) break;
        const paidAt = new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000);

        await upsertCoachPaymentFromStripe(supabaseAdmin, directory, {
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          stripeCheckoutSessionId: session.id,
          customerEmail,
          amountCents,
          currency: session.currency ?? "gbp",
          status: "succeeded",
          paidAtIso: paidAt.toISOString(),
          metadataCoachId:
            typeof session.metadata?.coach_id === "string"
              ? session.metadata.coach_id
              : null,
          notes: "synced via checkout.session.completed",
        });
        break;
      }
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const customerEmail = coalesceEmail(
          intent.receipt_email,
          intent.latest_charge && typeof intent.latest_charge !== "string"
            ? intent.latest_charge.billing_details?.email
            : null,
          intent.charges.data[0]?.billing_details?.email
        );
        if (!customerEmail) break;
        const amountCents =
          event.type === "payment_intent.succeeded"
            ? intent.amount_received || intent.amount
            : intent.amount;
        if (!amountCents || amountCents <= 0) break;
        const paidAt = new Date((intent.created ?? Math.floor(Date.now() / 1000)) * 1000);

        await upsertCoachPaymentFromStripe(supabaseAdmin, directory, {
          stripePaymentIntentId: intent.id,
          stripeCheckoutSessionId: null,
          customerEmail,
          amountCents,
          currency: intent.currency,
          status: event.type === "payment_intent.succeeded" ? "succeeded" : "failed",
          paidAtIso: paidAt.toISOString(),
          metadataCoachId:
            typeof intent.metadata?.coach_id === "string" ? intent.metadata.coach_id : null,
          notes: `synced via ${event.type}`,
        });
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const customerEmail = coalesceEmail(
          charge.billing_details?.email,
          charge.receipt_email
        );
        if (!customerEmail) break;
        const refundedAmount = charge.amount_refunded || charge.amount;
        if (!refundedAmount || refundedAmount <= 0) break;
        const refundedAt = new Date((charge.created ?? Math.floor(Date.now() / 1000)) * 1000);

        await upsertCoachPaymentFromStripe(supabaseAdmin, directory, {
          stripePaymentIntentId:
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent?.id ?? null,
          stripeCheckoutSessionId: null,
          customerEmail,
          amountCents: refundedAmount,
          currency: charge.currency,
          status: "refunded",
          paidAtIso: refundedAt.toISOString(),
          metadataCoachId:
            typeof charge.metadata?.coach_id === "string" ? charge.metadata.coach_id : null,
          notes: "synced via charge.refunded",
        });
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe webhook processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}


import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import { loadCoachDirectory, upsertCoachPaymentFromStripe } from "@/lib/stripePaymentsSync";

function coalesceEmail(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) return trimmed;
  }
  return null;
}

export type BackfillStripePaymentsResult = {
  processed: number;
  synced: number;
  skipped: number;
  failed: number;
  errors: Array<{ paymentIntentId: string; message: string }>;
};

export async function backfillStripePayments(
  supabase: SupabaseClient,
  stripe: Stripe,
  options?: { maxErrors?: number }
): Promise<BackfillStripePaymentsResult> {
  const maxErrors = options?.maxErrors ?? 20;
  const directory = await loadCoachDirectory(supabase);

  let processed = 0;
  let synced = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ paymentIntentId: string; message: string }> = [];

  await stripe.paymentIntents
    .list({
      limit: 100,
      expand: ["data.latest_charge"],
    })
    .autoPagingEach(async (paymentIntent) => {
      processed += 1;

      if (paymentIntent.status !== "succeeded") {
        skipped += 1;
        return;
      }

      const customerEmail = coalesceEmail(
        paymentIntent.receipt_email,
        paymentIntent.latest_charge && typeof paymentIntent.latest_charge !== "string"
          ? paymentIntent.latest_charge.billing_details?.email
          : null
      );

      const amountCents = paymentIntent.amount_received || paymentIntent.amount;
      if (!customerEmail || !amountCents || amountCents <= 0) {
        skipped += 1;
        return;
      }

      try {
        await upsertCoachPaymentFromStripe(supabase, directory, {
          stripePaymentIntentId: paymentIntent.id,
          stripeCheckoutSessionId: null,
          customerEmail,
          amountCents,
          currency: paymentIntent.currency,
          status: "succeeded",
          paidAtIso: new Date(paymentIntent.created * 1000).toISOString(),
          metadataCoachId:
            typeof paymentIntent.metadata?.coach_id === "string"
              ? paymentIntent.metadata.coach_id
              : null,
          notes: "backfilled from Stripe payment_intents",
        });
        synced += 1;
      } catch (error) {
        failed += 1;
        if (errors.length < maxErrors) {
          errors.push({
            paymentIntentId: paymentIntent.id,
            message: (error as Error).message,
          });
        }
      }
    });

  return { processed, synced, skipped, failed, errors };
}

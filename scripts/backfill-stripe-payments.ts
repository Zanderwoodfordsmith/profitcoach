/**
 * One-off import: sync historical Stripe payment intents into coach_payments.
 *
 * Run:
 *   npx tsx scripts/backfill-stripe-payments.ts
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STRIPE_SECRET_KEY
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import { loadCoachDirectory, upsertCoachPaymentFromStripe } from "../src/lib/stripePaymentsSync";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !STRIPE_SECRET_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or STRIPE_SECRET_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

function coalesceEmail(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) return trimmed;
  }
  return null;
}

async function main() {
  console.log("[stripe backfill] loading coach directory...");
  const directory = await loadCoachDirectory(supabase);
  console.log(`[stripe backfill] loaded ${directory.coachById.size} coach profile(s)`);

  let processed = 0;
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  await stripe.paymentIntents.list({
    limit: 100,
    expand: ["data.latest_charge"],
  }).autoPagingEach(async (paymentIntent) => {
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
      console.error(
        `[stripe backfill] failed for payment_intent ${paymentIntent.id}:`,
        (error as Error).message
      );
    }

    if (processed % 100 === 0) {
      console.log(
        `[stripe backfill] processed=${processed} synced=${synced} skipped=${skipped} failed=${failed}`
      );
    }
  });

  console.log(
    `[stripe backfill] done. processed=${processed} synced=${synced} skipped=${skipped} failed=${failed}`
  );
}

main().catch((error) => {
  console.error("[stripe backfill] fatal:", error);
  process.exit(1);
});


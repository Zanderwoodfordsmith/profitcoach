/**
 * One-off import: sync historical Stripe payment intents into coach_payments.
 *
 * Run locally (uses .env.local):
 *   npm run backfill-stripe-payments
 *
 * Or use Admin → Payments → "Import from Stripe" on production.
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STRIPE_SECRET_KEY
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import { backfillStripePayments } from "../src/lib/backfillStripePayments";

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

async function main() {
  console.log("[stripe backfill] starting...");
  const result = await backfillStripePayments(supabase, stripe, { maxErrors: 50 });

  if (result.errors.length > 0) {
    for (const item of result.errors) {
      console.error(`[stripe backfill] failed for ${item.paymentIntentId}:`, item.message);
    }
  }

  console.log(
    `[stripe backfill] done. processed=${result.processed} synced=${result.synced} skipped=${result.skipped} failed=${result.failed}`
  );
}

main().catch((error) => {
  console.error("[stripe backfill] fatal:", error);
  process.exit(1);
});

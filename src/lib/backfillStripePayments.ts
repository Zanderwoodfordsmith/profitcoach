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

function paymentIntentIdFrom(
  value: string | Stripe.PaymentIntent | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id ?? null;
}

export function stripeKeyMode(
  key: string | undefined
): "live" | "test" | "unknown" | "missing" {
  const trimmed = key?.trim() ?? "";
  if (!trimmed || trimmed === "sk_test_placeholder") return "missing";
  if (trimmed.startsWith("sk_live_")) return "live";
  if (trimmed.startsWith("sk_test_")) return "test";
  return "unknown";
}

export type BackfillSourceStats = {
  processed: number;
  synced: number;
  skipped: number;
  failed: number;
};

export type BackfillStripePaymentsResult = {
  processed: number;
  synced: number;
  skipped: number;
  failed: number;
  sources: {
    paymentIntents: BackfillSourceStats;
    charges: BackfillSourceStats;
    checkoutSessions: BackfillSourceStats;
    invoices: BackfillSourceStats;
  };
  diagnostics: {
    stripeKeyMode: ReturnType<typeof stripeKeyMode>;
    stripeSampleCounts: {
      paymentIntents: number;
      charges: number;
      checkoutSessions: number;
      invoices: number;
    };
  };
  errors: Array<{ id: string; source: string; message: string }>;
};

function emptySourceStats(): BackfillSourceStats {
  return { processed: 0, synced: 0, skipped: 0, failed: 0 };
}

function mergeTotals(
  target: Pick<BackfillStripePaymentsResult, "processed" | "synced" | "skipped" | "failed">,
  source: BackfillSourceStats
) {
  target.processed += source.processed;
  target.synced += source.synced;
  target.skipped += source.skipped;
  target.failed += source.failed;
}

export async function backfillStripePayments(
  supabase: SupabaseClient,
  stripe: Stripe,
  options?: { maxErrors?: number; stripeSecretKey?: string }
): Promise<BackfillStripePaymentsResult> {
  const maxErrors = options?.maxErrors ?? 20;
  const directory = await loadCoachDirectory(supabase);

  const sources = {
    paymentIntents: emptySourceStats(),
    charges: emptySourceStats(),
    checkoutSessions: emptySourceStats(),
    invoices: emptySourceStats(),
  };

  const result: BackfillStripePaymentsResult = {
    processed: 0,
    synced: 0,
    skipped: 0,
    failed: 0,
    sources,
    diagnostics: {
      stripeKeyMode: stripeKeyMode(options?.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY),
      stripeSampleCounts: {
        paymentIntents: 0,
        charges: 0,
        checkoutSessions: 0,
        invoices: 0,
      },
    },
    errors: [],
  };

  const recordError = (source: string, id: string, error: unknown) => {
    if (result.errors.length < maxErrors) {
      result.errors.push({
        source,
        id,
        message: (error as Error).message,
      });
    }
  };

  const tryUpsert = async (
    source: keyof typeof sources,
    id: string,
    input: Parameters<typeof upsertCoachPaymentFromStripe>[2]
  ) => {
    const stats = sources[source];
    stats.processed += 1;
    try {
      await upsertCoachPaymentFromStripe(supabase, directory, input);
      stats.synced += 1;
    } catch (error) {
      stats.failed += 1;
      recordError(source, id, error);
    }
  };

  const [paymentIntentSample, chargeSample, checkoutSample, invoiceSample] =
    await Promise.all([
      stripe.paymentIntents.list({ limit: 1 }),
      stripe.charges.list({ limit: 1 }),
      stripe.checkout.sessions.list({ status: "complete", limit: 1 }),
      stripe.invoices.list({ status: "paid", limit: 1 }),
    ]);

  result.diagnostics.stripeSampleCounts = {
    paymentIntents: paymentIntentSample.data.length,
    charges: chargeSample.data.length,
    checkoutSessions: checkoutSample.data.length,
    invoices: invoiceSample.data.length,
  };

  await stripe.paymentIntents
    .list({
      limit: 100,
      expand: ["data.latest_charge"],
    })
    .autoPagingEach(async (paymentIntent) => {
      if (paymentIntent.status !== "succeeded") {
        sources.paymentIntents.processed += 1;
        sources.paymentIntents.skipped += 1;
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
        sources.paymentIntents.processed += 1;
        sources.paymentIntents.skipped += 1;
        return;
      }

      await tryUpsert("paymentIntents", paymentIntent.id, {
        stripePaymentIntentId: paymentIntent.id,
        stripeCheckoutSessionId: null,
        stripeChargeId: null,
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
    });

  await stripe.charges
    .list({ limit: 100 })
    .autoPagingEach(async (charge) => {
      if (!charge.paid || charge.status !== "succeeded") {
        sources.charges.processed += 1;
        sources.charges.skipped += 1;
        return;
      }

      const customerEmail = coalesceEmail(
        charge.billing_details?.email,
        charge.receipt_email
      );
      const amountCents = charge.amount;
      if (!customerEmail || !amountCents || amountCents <= 0) {
        sources.charges.processed += 1;
        sources.charges.skipped += 1;
        return;
      }

      const paymentIntentId = paymentIntentIdFrom(charge.payment_intent);

      await tryUpsert("charges", charge.id, {
        stripePaymentIntentId: paymentIntentId,
        stripeCheckoutSessionId: null,
        stripeChargeId: paymentIntentId ? null : charge.id,
        customerEmail,
        amountCents,
        currency: charge.currency,
        status: "succeeded",
        paidAtIso: new Date(charge.created * 1000).toISOString(),
        metadataCoachId:
          typeof charge.metadata?.coach_id === "string" ? charge.metadata.coach_id : null,
        notes: paymentIntentId
          ? "backfilled from Stripe charges (via payment_intent)"
          : "backfilled from Stripe charges",
      });
    });

  await stripe.checkout.sessions
    .list({
      status: "complete",
      limit: 100,
    })
    .autoPagingEach(async (session) => {
      if (session.payment_status && session.payment_status !== "paid") {
        sources.checkoutSessions.processed += 1;
        sources.checkoutSessions.skipped += 1;
        return;
      }

      const customerEmail = coalesceEmail(
        session.customer_details?.email,
        session.customer_email
      );
      const amountCents = session.amount_total ?? 0;
      if (!customerEmail || !amountCents || amountCents <= 0) {
        sources.checkoutSessions.processed += 1;
        sources.checkoutSessions.skipped += 1;
        return;
      }

      await tryUpsert("checkoutSessions", session.id, {
        stripePaymentIntentId: paymentIntentIdFrom(session.payment_intent),
        stripeCheckoutSessionId: session.id,
        stripeChargeId: null,
        customerEmail,
        amountCents,
        currency: session.currency ?? "gbp",
        status: "succeeded",
        paidAtIso: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        metadataCoachId:
          typeof session.metadata?.coach_id === "string" ? session.metadata.coach_id : null,
        notes: "backfilled from Stripe checkout sessions",
      });
    });

  await stripe.invoices
    .list({
      status: "paid",
      limit: 100,
      expand: ["data.customer"],
    })
    .autoPagingEach(async (invoice) => {
      const customer =
        invoice.customer && typeof invoice.customer !== "string" ? invoice.customer : null;
      const customerEmail = coalesceEmail(
        invoice.customer_email,
        customer && "email" in customer ? (customer.email as string | null) : null
      );
      const amountCents = invoice.amount_paid;
      if (!customerEmail || !amountCents || amountCents <= 0) {
        sources.invoices.processed += 1;
        sources.invoices.skipped += 1;
        return;
      }

      const paidAtSeconds =
        invoice.status_transitions?.paid_at ?? invoice.created ?? Math.floor(Date.now() / 1000);

      await tryUpsert("invoices", invoice.id, {
        stripePaymentIntentId: paymentIntentIdFrom(invoice.payment_intent),
        stripeCheckoutSessionId: null,
        stripeChargeId: null,
        customerEmail,
        amountCents,
        currency: invoice.currency,
        status: "succeeded",
        paidAtIso: new Date(paidAtSeconds * 1000).toISOString(),
        metadataCoachId:
          typeof invoice.metadata?.coach_id === "string" ? invoice.metadata.coach_id : null,
        notes: "backfilled from Stripe invoices",
      });
    });

  for (const stats of Object.values(sources)) {
    mergeTotals(result, stats);
  }

  return result;
}

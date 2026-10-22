/**
 * One-off: link past bookings to campaign leads, and fill each coach's
 * Stripe subscription start (day 1 for days to first call).
 *
 *   npx tsx scripts/backfill-booking-lead-links.ts           (dry run)
 *   npx tsx scripts/backfill-booking-lead-links.ts --apply
 *
 * Safe to rerun: only touches rows that have no link or start date yet.
 * Stripe is read only.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const APPLY = process.argv.includes("--apply");

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { findLeadForBooking } = await import("../src/lib/booking/leadLink");
  const { stripeServer } = await import("../src/lib/stripeServer");

  // 1. Stripe start dates.
  const { data: coaches } = await supabaseAdmin
    .from("coaches")
    .select("id, slug, stripe_customer_id")
    .not("stripe_customer_id", "is", null)
    .is("membership_started_at", null);
  let started = 0;
  for (const c of coaches ?? []) {
    try {
      const subs = await stripeServer.subscriptions.list({ customer: c.stripe_customer_id as string, status: "all", limit: 100 });
      const first = Math.min(...subs.data.map((s) => s.start_date).filter(Boolean));
      if (!Number.isFinite(first)) continue;
      started += 1;
      const iso = new Date(first * 1000).toISOString();
      if (APPLY) await supabaseAdmin.from("coaches").update({ membership_started_at: iso }).eq("id", c.id).is("membership_started_at", null);
    } catch (err) {
      console.warn(`stripe ${c.slug}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`Stripe start dates: ${started} of ${(coaches ?? []).length} coaches with a Stripe customer.`);

  // 2. Bookings.
  for (const table of ["ghl_appointments", "bookings"] as const) {
    const { data: rows } = await supabaseAdmin
      .from(table)
      .select("id, coach_id, contact_id, prospect_name")
      .not("coach_id", "is", null)
      .is("campaign_lead_id", null)
      .range(0, 4999);
    const counts = { link: 0, contact: 0, name: 0, none: 0 };
    for (const r of rows ?? []) {
      const found = await findLeadForBooking({
        coachId: r.coach_id as string,
        contactId: (r.contact_id as string | null) ?? null,
        prospectName: (r.prospect_name as string | null) ?? null,
      });
      if (!found) {
        counts.none += 1;
        continue;
      }
      counts[found.match] += 1;
      if (APPLY) {
        await supabaseAdmin.from(table).update({ campaign_lead_id: found.leadId, lead_match: found.match }).eq("id", r.id);
      }
    }
    console.log(`${table}: ${(rows ?? []).length} without a lead →`, counts);
  }
  console.log(APPLY ? "Saved." : "Dry run. Add --apply to save.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

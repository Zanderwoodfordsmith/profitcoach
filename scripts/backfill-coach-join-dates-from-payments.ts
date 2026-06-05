/**
 * Set disco_community_joined_on from each coach's earliest succeeded payment.
 *
 * Usage:
 *   npx tsx scripts/backfill-coach-join-dates-from-payments.ts --dry-run
 *   npx tsx scripts/backfill-coach-join-dates-from-payments.ts
 *   npx tsx scripts/backfill-coach-join-dates-from-payments.ts --only-historical
 *   npx tsx scripts/backfill-coach-join-dates-from-payments.ts --prefer-payments
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const onlyHistorical = argv.includes("--only-historical");
const preferPayments = argv.includes("--prefer-payments");
const onlyEmpty = argv.includes("--only-empty");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  let coachQuery = supabase
    .from("coaches")
    .select("id, slug, record_kind, profiles!inner(full_name, disco_community_joined_on)");

  if (onlyHistorical) {
    coachQuery = coachQuery.eq("record_kind", "historical");
  }

  let { data: coaches, error: coachError } = await coachQuery;
  if (coachError?.code === "42703") {
    ({ data: coaches, error: coachError } = await supabase
      .from("coaches")
      .select("id, slug, profiles!inner(full_name, disco_community_joined_on)"));
    if (onlyHistorical) {
      console.warn("--only-historical ignored (apply migration 20260628120000)");
    }
  }
  if (coachError) {
    console.error(coachError.message);
    process.exit(1);
  }

  const { data: payments, error: payError } = await supabase
    .from("coach_payments")
    .select("coach_id, paid_at, status")
    .eq("status", "succeeded")
    .not("coach_id", "is", null)
    .order("paid_at", { ascending: true });

  if (payError) {
    console.error(payError.message);
    process.exit(1);
  }

  const firstPaymentByCoach = new Map<string, string>();
  for (const p of payments ?? []) {
    const coachId = p.coach_id as string;
    if (!firstPaymentByCoach.has(coachId)) {
      firstPaymentByCoach.set(coachId, (p.paid_at as string).slice(0, 10));
    }
  }

  let updated = 0;
  let unchanged = 0;
  let noPayments = 0;

  for (const row of coaches ?? []) {
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const coachId = row.id as string;
    const slug = row.slug as string;
    if (slug === "profit-coach-snapshot") {
      unchanged++;
      continue;
    }
    const fullName = (prof?.full_name as string | null) ?? slug;
    const current = (prof?.disco_community_joined_on as string | null)?.slice(0, 10) ?? null;
    const firstPaid = firstPaymentByCoach.get(coachId) ?? null;

    if (!firstPaid) {
      noPayments++;
      continue;
    }

    if (onlyEmpty && current) {
      unchanged++;
      continue;
    }

    if (!preferPayments && current && current <= firstPaid) {
      unchanged++;
      continue;
    }

    if (current === firstPaid) {
      unchanged++;
      continue;
    }

    console.log(
      `${dryRun ? "[dry-run] " : ""}${slug} (${fullName}): ${current ?? "—"} → ${firstPaid} (first payment)`
    );

    if (!dryRun) {
      const { error } = await supabase
        .from("profiles")
        .update({ disco_community_joined_on: firstPaid })
        .eq("id", coachId);
      if (error) {
        console.error(`Failed ${slug}:`, error.message);
        process.exit(1);
      }
    }
    updated++;
  }

  console.log("\n--- Summary ---");
  console.log(`Coaches checked: ${coaches?.length ?? 0}`);
  console.log(`${dryRun ? "Would update" : "Updated"}: ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`No assigned payments: ${noPayments}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

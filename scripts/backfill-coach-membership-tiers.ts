/**
 * One-time backfill: set each coach's access_tier from their billing status.
 *
 * Rule (as agreed):
 *   - Covered -> premium, when ANY of:
 *       * active recurring billing (e.g. £495/£399 paid within the last 75 days)
 *       * recurring_payment_status of monthly | annual_prepaid | first_6_months | complimentary
 *       * still within their first 6 months (build phase), based on earliest succeeded payment
 *   - Otherwise (outside 6 months and not currently paying) -> alumni
 *
 * Safety:
 *   - DRY RUN BY DEFAULT. Nothing is written unless you pass --apply.
 *   - Coaches with access_tier_locked = true are SKIPPED (manual overrides /
 *     complimentary grants you set by hand are never touched).
 *   - Because tier enforcement is off, this only records "who is on what";
 *     it does not change what anyone can access until ENFORCE_MEMBERSHIP_TIERS=true.
 *
 * Usage:
 *   npx tsx scripts/backfill-coach-membership-tiers.ts            (dry run, shows changes)
 *   npx tsx scripts/backfill-coach-membership-tiers.ts --apply    (writes changes)
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { coachHasActiveRecurringBilling } from "../src/lib/coachRecurringBilling";
import {
  isCoachRecurringPaymentStatus,
  type CoachRecurringPaymentStatus,
} from "../src/lib/coachBilling";
import type { CoachAccessTier } from "../src/lib/coachAccess/tiers";
import type { PaymentForBillingKind } from "../src/lib/paymentBillingKind";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const verbose = argv.includes("--verbose");
const dryRun = !apply;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** First 6 months = build phase; treat these coaches as covered (premium). */
const BUILD_PHASE_MONTHS = 6;

function buildPhaseCutoffIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - BUILD_PHASE_MONTHS);
  return d.toISOString();
}

const BUILD_PHASE_CUTOFF_ISO = buildPhaseCutoffIso();

/** Why a coach is treated as covered (for transparent dry-run output), or null. */
function coveredReason(
  status: CoachRecurringPaymentStatus | null,
  payments: PaymentForBillingKind[],
  earliestPaidAtIso: string | null
): string | null {
  if (status === "complimentary") return "complimentary";
  if (
    coachHasActiveRecurringBilling({ recurringPaymentStatus: status, payments })
  ) {
    return status ?? "active recurring payment";
  }
  if (earliestPaidAtIso && earliestPaidAtIso >= BUILD_PHASE_CUTOFF_ISO) {
    return "within first 6 months";
  }
  return null;
}

async function main() {
  const { data: coaches, error: coachError } = await supabase
    .from("coaches")
    .select(
      "id, slug, access_tier, access_tier_locked, recurring_payment_status, profiles!inner(full_name)"
    );

  if (coachError) {
    console.error(coachError.message);
    process.exit(1);
  }

  const { data: payments, error: payError } = await supabase
    .from("coach_payments")
    .select("id, coach_id, amount_cents, currency, status, paid_at, billing_kind_override")
    .eq("status", "succeeded")
    .not("coach_id", "is", null);

  if (payError) {
    console.error(payError.message);
    process.exit(1);
  }

  const paymentsByCoach = new Map<string, PaymentForBillingKind[]>();
  const earliestPaidByCoach = new Map<string, string>();
  for (const p of payments ?? []) {
    const coachId = p.coach_id as string;
    const paidAt = p.paid_at as string;
    const list = paymentsByCoach.get(coachId) ?? [];
    list.push({
      id: p.id as string,
      customer_email: "",
      amount_cents: p.amount_cents as number,
      currency: (p.currency as string) ?? "gbp",
      status: p.status as string,
      paid_at: paidAt,
      description: null,
      billing_kind_override:
        (p.billing_kind_override as PaymentForBillingKind["billing_kind_override"]) ??
        null,
    });
    paymentsByCoach.set(coachId, list);

    const currentEarliest = earliestPaidByCoach.get(coachId);
    if (!currentEarliest || paidAt < currentEarliest) {
      earliestPaidByCoach.set(coachId, paidAt);
    }
  }

  let toPremium = 0;
  let toAlumni = 0;
  let unchanged = 0;
  let skippedLocked = 0;

  for (const row of coaches ?? []) {
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const coachId = row.id as string;
    const slug = row.slug as string;
    const fullName = (prof?.full_name as string | null) ?? slug;

    if (slug === "profit-coach-snapshot") {
      unchanged++;
      continue;
    }

    if (row.access_tier_locked || row.access_tier === "do_not_contact") {
      skippedLocked++;
      continue;
    }

    const current = (row.access_tier as CoachAccessTier | null) ?? "premium";
    const statusRaw = (row.recurring_payment_status as string | null) ?? null;
    const status =
      statusRaw && isCoachRecurringPaymentStatus(statusRaw) ? statusRaw : null;

    const covered = coveredReason(
      status,
      paymentsByCoach.get(coachId) ?? [],
      earliestPaidByCoach.get(coachId) ?? null
    );
    const target: CoachAccessTier = covered ? "premium" : "alumni";

    if (target === current) {
      unchanged++;
      if (verbose && covered) {
        console.log(`  keep premium: ${slug} (${fullName})  [${covered}]`);
      }
      continue;
    }

    const reason = covered ?? (status ?? "outside 6 months, not paying");
    console.log(
      `${dryRun ? "[dry-run] " : ""}${slug} (${fullName}): ${current} → ${target}  [${reason}]`
    );

    if (target === "premium") toPremium++;
    else toAlumni++;

    if (apply) {
      const { error } = await supabase
        .from("coaches")
        .update({ access_tier: target })
        .eq("id", coachId);
      if (error) {
        console.error(`Failed ${slug}:`, error.message);
        process.exit(1);
      }
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "APPLIED"}`);
  console.log(`Coaches checked: ${coaches?.length ?? 0}`);
  console.log(`${dryRun ? "Would set" : "Set"} → premium: ${toPremium}`);
  console.log(`${dryRun ? "Would set" : "Set"} → alumni: ${toAlumni}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Skipped (tier locked): ${skippedLocked}`);
  if (dryRun) {
    console.log("\nRe-run with --apply to write these changes.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

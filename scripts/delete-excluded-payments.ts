/**
 * Delete internal / low-value payments from coach_payments.
 *
 * Usage:
 *   npx tsx scripts/delete-excluded-payments.ts --dry-run
 *   npx tsx scripts/delete-excluded-payments.ts
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  isExcludedCustomerEmail,
  paymentImportSkipReason,
} from "../src/lib/paymentImportFilters";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rows, error } = await supabase
    .from("coach_payments")
    .select("id, customer_email, amount_cents, currency, paid_at, status");

  if (error) {
    console.error("Fetch failed:", error.message);
    process.exit(1);
  }

  const toDelete = (rows ?? []).filter((row) => {
    const email = String(row.customer_email ?? "");
    const amountCents = row.amount_cents as number;
    const currency = String(row.currency ?? "");
    return (
      isExcludedCustomerEmail(email) ||
      paymentImportSkipReason(email, amountCents, currency) != null
    );
  });

  console.log(`Found ${toDelete.length} payment(s) to delete.`);

  const byReason = { excluded_email: 0, below_minimum_amount: 0, both: 0 };
  for (const row of toDelete) {
    const email = String(row.customer_email ?? "");
    const excluded = isExcludedCustomerEmail(email);
    const below = paymentImportSkipReason(
      email,
      row.amount_cents as number,
      String(row.currency ?? "")
    );
    if (excluded && below) byReason.both += 1;
    else if (excluded) byReason.excluded_email += 1;
    else if (below) byReason.below_minimum_amount += 1;
  }
  console.log("By reason:", byReason);

  for (const row of toDelete.slice(0, 20)) {
    console.log(
      `  - ${row.customer_email} | ${(row.amount_cents as number) / 100} ${row.currency} | ${row.status} | ${row.paid_at}`
    );
  }
  if (toDelete.length > 20) {
    console.log(`  ... and ${toDelete.length - 20} more`);
  }

  if (toDelete.length === 0) {
    return;
  }

  if (dryRun) {
    console.log("\nDry run — no rows deleted.");
    return;
  }

  const ids = toDelete.map((r) => r.id as string);
  const { error: deleteError } = await supabase
    .from("coach_payments")
    .delete()
    .in("id", ids);

  if (deleteError) {
    console.error("Delete failed:", deleteError.message);
    process.exit(1);
  }

  console.log(`\nDeleted ${ids.length} payment(s).`);
}

void main();

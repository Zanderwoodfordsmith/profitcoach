/**
 * Delete coach_payments matching BCA auto-recharge wallet top-ups.
 *
 * Usage:
 *   npx tsx scripts/delete-auto-recharge-payments.ts --dry-run
 *   npx tsx scripts/delete-auto-recharge-payments.ts
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CUSTOMER_EMAIL = "zander@businesscoachacademy.com";
const DESCRIPTION_PATTERN = "Auto-Recharge for Sub-Account";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rows, error: fetchError } = await supabase
    .from("coach_payments")
    .select("id, customer_email, description, amount_cents, currency, paid_at, status")
    .ilike("customer_email", CUSTOMER_EMAIL)
    .ilike("description", `%${DESCRIPTION_PATTERN}%`);

  if (fetchError) {
    console.error("Fetch failed:", fetchError.message);
    process.exit(1);
  }

  const matches = rows ?? [];
  console.log(`Found ${matches.length} payment(s) to delete.`);

  for (const row of matches) {
    const desc = (row.description ?? "").replace(/\s+/g, " ").slice(0, 100);
    console.log(
      `  - ${row.id} | ${row.paid_at} | ${row.amount_cents / 100} ${row.currency} | ${row.status} | ${desc}`
    );
  }

  if (matches.length === 0) {
    return;
  }

  if (dryRun) {
    console.log("\nDry run — no rows deleted.");
    return;
  }

  const ids = matches.map((r) => r.id);
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

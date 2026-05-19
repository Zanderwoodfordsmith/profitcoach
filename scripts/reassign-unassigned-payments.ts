/**
 * Re-run email / company / name matching on unassigned coach_payments.
 *
 * Usage:
 *   npx tsx scripts/reassign-unassigned-payments.ts --dry-run
 *   npx tsx scripts/reassign-unassigned-payments.ts
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  loadCoachDirectory,
  suggestCoachForPayment,
} from "../src/lib/stripePaymentsSync";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const directory = await loadCoachDirectory(supabase);

  const { data: payments, error } = await supabase
    .from("coach_payments")
    .select(
      "id, customer_email, customer_company_name, description, assignment_method, coach_id"
    )
    .is("coach_id", null)
    .order("paid_at", { ascending: false });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let matched = 0;
  let stillUnassigned = 0;

  for (const row of payments ?? []) {
    if (row.assignment_method === "manual" && row.coach_id) continue;

    const companyLabel =
      (row.customer_company_name as string | null)?.trim() ||
      (row.description as string | null)?.trim() ||
      null;

    const suggestion = suggestCoachForPayment(
      directory,
      row.customer_email as string,
      companyLabel
    );

    if (!suggestion) {
      stillUnassigned++;
      continue;
    }

    console.log(
      `${dryRun ? "[dry-run] " : ""}Payment ${row.id.slice(0, 8)}… → ${suggestion.slug} (${suggestion.full_name})`
    );

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("coach_payments")
        .update({
          coach_id: suggestion.id,
          assignment_method: "company_auto",
        })
        .eq("id", row.id);

      if (updateError) {
        console.error(updateError.message);
        process.exit(1);
      }
    }
    matched++;
  }

  console.log("\n--- Summary ---");
  console.log(`Unassigned scanned: ${payments?.length ?? 0}`);
  console.log(`${dryRun ? "Would match" : "Matched"}: ${matched}`);
  console.log(`Still unassigned: ${stillUnassigned}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

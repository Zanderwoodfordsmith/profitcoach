/**
 * Import Stripe unified_payments.csv export into coach_payments.
 *
 * Prerequisites:
 *   - Apply migrations through `20260624120000_coach_payments_csv_import.sql`
 *   - `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npm run import-stripe-payments -- --dry-run "/path/to/unified_payments.csv"
 *   npm run import-stripe-payments -- "/path/to/unified_payments.csv"
 *   npm run import-stripe-payments -- --paid-only "/path/to/unified_payments.csv"
 *   npm run import-stripe-payments -- --legacy-products "/path/to/old-charges-export.csv"
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  formatStripeCsvImportSummary,
  importStripePaymentsCsv,
} from "../src/lib/stripePaymentsCsvImport";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const paidOnly = argv.includes("--paid-only");
const includeIncomplete = argv.includes("--include-incomplete");
const legacyProducts =
  argv.includes("--legacy-products") || argv.includes("--legacy-product-filter");
const noLegacyProducts = argv.includes("--no-legacy-products");
const csvPath = argv.filter((a) => !a.startsWith("--")).at(0);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if (!csvPath?.trim()) {
  console.error(
    "Usage: npm run import-stripe-payments -- [--dry-run] [--paid-only] [--include-incomplete] <path-to.csv>"
  );
  process.exit(1);
}

const resolvedCsv = path.resolve(csvPath.trim());
if (!fs.existsSync(resolvedCsv)) {
  console.error(`CSV not found: ${resolvedCsv}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const csvText = fs.readFileSync(resolvedCsv, "utf8");
  console.log(`[stripe csv] reading ${resolvedCsv}`);
  if (dryRun) {
    console.log("[stripe csv] dry run — no database writes");
  }

  const result = await importStripePaymentsCsv(supabase, csvText, {
    dryRun,
    paidOnly,
    includeIncomplete,
    legacyProductFilter: noLegacyProducts ? false : legacyProducts || undefined,
  });

  console.log(formatStripeCsvImportSummary(result));
  if (result.errors.length > 0) {
    for (const item of result.errors) {
      console.error(`[stripe csv] row ${item.row}: ${item.message}`);
    }
  }
}

main().catch((error) => {
  console.error("[stripe csv] fatal:", error);
  process.exit(1);
});

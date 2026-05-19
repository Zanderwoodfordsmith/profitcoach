/**
 * Import Revolut merchant account CSV export into coach_payments.
 *
 * Usage:
 *   npm run import-revolut-payments -- --dry-run "/path/to/revolut-export.csv"
 *   npm run import-revolut-payments -- "/path/to/revolut-export.csv"
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  formatRevolutCsvImportSummary,
  importRevolutMerchantPaymentsCsv,
} from "../src/lib/revolutPaymentsCsvImport";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const csvPath = argv.filter((a) => !a.startsWith("--")).at(0);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if (!csvPath?.trim()) {
  console.error(
    "Usage: npm run import-revolut-payments -- [--dry-run] <path-to.csv>"
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
  console.log(`[revolut csv] reading ${resolvedCsv}`);
  if (dryRun) console.log("[revolut csv] dry run — no database writes");

  const result = await importRevolutMerchantPaymentsCsv(supabase, csvText, {
    dryRun,
    includeFailed: true,
  });

  console.log(formatRevolutCsvImportSummary(result));
  if (result.errors.length > 0) {
    for (const item of result.errors) {
      console.error(`[revolut csv] row ${item.row}: ${item.message}`);
    }
  }
}

main().catch((error) => {
  console.error("[revolut csv] fatal:", error);
  process.exit(1);
});

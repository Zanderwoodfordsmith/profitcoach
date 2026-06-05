/**
 * Import Sales Robot customer metrics into coaches:
 *   - has_sales_robot_account: payingAccounts >= 1
 *   - sales_robot_active_campaigns: activeCampaignCount
 *   - sales_robot_paying_accounts: payingAccounts
 *
 * Resets all coaches' Sales Robot fields before applying the export.
 *
 * Matching: coach auth email first, exact name, then fuzzy surname (Goldberg/Goldberger).
 *
 * Prerequisites:
 *   - Apply migration `20260622120000_coach_sales_robot_metrics.sql`
 *   - `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/import-sales-robot-customers-from-csv.ts --dry-run "/path/to/CustomerList.csv"
 *   npx tsx scripts/import-sales-robot-customers-from-csv.ts "/path/to/CustomerList.csv"
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

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
    "Usage: npx tsx scripts/import-sales-robot-customers-from-csv.ts [--dry-run] <path-to.csv>"
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

type CsvRow = {
  adminEmail?: string;
  adminFullName?: string;
  activeCampaignCount?: string;
  payingAccounts?: string;
};

const HONORIFIC_PREFIX_RE =
  /^(mr|mrs|ms|miss|dr|prof|sir|dame|lord|lady)\.?\s+/i;

/** Lowercase name for matching; strips common honorifics (Mr, Dr, etc.). */
function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(HONORIFIC_PREFIX_RE, "");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseCount(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseNameParts(
  value: string
): { first: string; last: string } | null {
  const parts = normalizePersonName(value).split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return { first: parts[0]!, last: parts[parts.length - 1]! };
}

/** Handles minor surname spelling differences, e.g. Goldberg vs Goldberger. */
function lastNamesLikelySame(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return longer.startsWith(shorter) && longer.length - shorter.length <= 2;
}

function findFuzzyNameMatch(
  csvName: string,
  namesById: Map<string, string>
): string | null {
  const csvParts = parseNameParts(csvName);
  if (!csvParts) return null;

  const matches: string[] = [];
  for (const [id, fullName] of namesById) {
    const coachParts = parseNameParts(fullName);
    if (!coachParts) continue;
    if (
      csvParts.first === coachParts.first &&
      lastNamesLikelySame(csvParts.last, coachParts.last)
    ) {
      matches.push(id);
    }
  }

  if (matches.length === 1) return matches[0]!;
  return null;
}

async function loadCoachDirectory(): Promise<{
  byName: Map<string, string[]>;
  byEmail: Map<string, string>;
  namesById: Map<string, string>;
}> {
  const { data: coaches, error } = await supabase
    .from("coaches")
    .select("id, profiles!inner(full_name)");

  if (error) {
    throw new Error(`Failed to load coaches: ${error.message}`);
  }

  const byName = new Map<string, string[]>();
  const namesById = new Map<string, string>();

  for (const row of coaches ?? []) {
    const id = row.id as string;
    const profRaw = row.profiles as
      | { full_name: string | null }
      | Array<{ full_name: string | null }>
      | undefined;
    const prof = Array.isArray(profRaw) ? profRaw[0] : profRaw;
    const fullName = (prof?.full_name ?? "").trim();
    if (!fullName) continue;
    namesById.set(id, fullName);
    const key = normalizePersonName(fullName);
    const list = byName.get(key) ?? [];
    if (!list.includes(id)) list.push(id);
    byName.set(key, list);
  }

  const byEmail = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (listError) {
      throw new Error(`listUsers page ${page}: ${listError.message}`);
    }
    const users = data.users ?? [];
    for (const user of users) {
      if (!user.email || !namesById.has(user.id)) continue;
      byEmail.set(normalizeEmail(user.email), user.id);
    }
    if (users.length < 1000) break;
    page += 1;
  }

  return { byName, byEmail, namesById };
}

function resolveCoachId(
  row: CsvRow,
  byName: Map<string, string[]>,
  byEmail: Map<string, string>,
  namesById: Map<string, string>
): { coachId: string | null; reason?: string } {
  const email = row.adminEmail?.trim();
  if (email) {
    const byMail = byEmail.get(normalizeEmail(email));
    if (byMail) return { coachId: byMail };
  }

  const name = row.adminFullName?.trim();
  if (!name) {
    return { coachId: null, reason: "missing name and email" };
  }

  const matches = byName.get(normalizePersonName(name)) ?? [];
  if (matches.length === 1) return { coachId: matches[0]! };
  if (matches.length > 1) {
    return {
      coachId: null,
      reason: `ambiguous name (${matches.map((id) => namesById.get(id)).join(", ")})`,
    };
  }

  const fuzzyMatch = findFuzzyNameMatch(name, namesById);
  if (fuzzyMatch) return { coachId: fuzzyMatch };

  return { coachId: null, reason: `no coach match for "${name}"` };
}

async function resetAllSalesRobotMetrics(): Promise<void> {
  const { error } = await supabase
    .from("coaches")
    .update({
      has_sales_robot_account: false,
      sales_robot_active_campaigns: null,
      sales_robot_paying_accounts: null,
    })
    .not("id", "is", null);

  if (error) {
    throw new Error(`Failed to reset Sales Robot metrics: ${error.message}`);
  }
}

async function main() {
  const csvText = fs.readFileSync(resolvedCsv, "utf8");
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  console.log(
    `[sales-robot import] ${dryRun ? "DRY RUN — " : ""}reading ${rows.length} rows from ${resolvedCsv}`
  );

  const { byName, byEmail, namesById } = await loadCoachDirectory();
  console.log(
    `[sales-robot import] loaded ${namesById.size} coaches (${byEmail.size} with email)`
  );

  if (dryRun) {
    console.log(
      "[sales-robot import] would reset all coaches: has_sales_robot_account=false, metrics=null"
    );
  } else {
    await resetAllSalesRobotMetrics();
    console.log(
      "[sales-robot import] reset all coaches: has_sales_robot_account=false, metrics=null"
    );
  }

  let updated = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const row of rows) {
    const { coachId, reason } = resolveCoachId(row, byName, byEmail, namesById);
    if (!coachId) {
      skipped += 1;
      unmatched.push(
        `${row.adminFullName ?? "?"} <${row.adminEmail ?? "?"}>: ${reason ?? "unknown"}`
      );
      continue;
    }

    const payingAccounts = parseCount(row.payingAccounts);
    const payload = {
      has_sales_robot_account: payingAccounts >= 1,
      sales_robot_active_campaigns: parseCount(row.activeCampaignCount),
      sales_robot_paying_accounts: payingAccounts,
    };

    const label = namesById.get(coachId) ?? coachId;
    if (dryRun) {
      console.log(
        `[dry-run] ${label}: campaigns=${payload.sales_robot_active_campaigns}, paying=${payload.sales_robot_paying_accounts}, sales_robot=${payload.has_sales_robot_account}`
      );
      updated += 1;
      continue;
    }

    const { error } = await supabase
      .from("coaches")
      .update(payload)
      .eq("id", coachId);

    if (error) {
      console.error(`[sales-robot import] failed for ${label}:`, error.message);
      skipped += 1;
      continue;
    }

    console.log(
      `[sales-robot import] updated ${label}: campaigns=${payload.sales_robot_active_campaigns}, paying=${payload.sales_robot_paying_accounts}`
    );
    updated += 1;
  }

  console.log(
    `[sales-robot import] done — updated ${updated}, skipped ${skipped}${dryRun ? " (dry run)" : ""}`
  );
  if (unmatched.length > 0) {
    console.log("[sales-robot import] unmatched rows:");
    for (const line of unmatched) console.log(`  - ${line}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

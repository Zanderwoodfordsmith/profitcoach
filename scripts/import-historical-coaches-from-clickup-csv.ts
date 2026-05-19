/**
 * Import ClickUp coaches not yet in the app as historical records (payment matching only).
 * No invites; placeholder email + hist-* slug. Join date from CSV when present.
 *
 * Usage:
 *   npx tsx scripts/import-historical-coaches-from-clickup-csv.ts --dry-run "/path/to/Coaches.csv"
 *   npx tsx scripts/import-historical-coaches-from-clickup-csv.ts "/path/to/Coaches.csv"
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";

import {
  matchCsvNameToCoach,
  normalizeCoachName,
} from "../src/lib/clickupCoachNameMatch";
import { formatPersonName } from "../src/lib/formatPersonName";
import { createHistoricalCoachRecord } from "../src/lib/historicalCoachRecords";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const csvPath = argv.filter((a) => !a.startsWith("--")).at(0);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

if (!csvPath?.trim()) {
  console.error(
    "Usage: npx tsx scripts/import-historical-coaches-from-clickup-csv.ts [--dry-run] <path-to.csv>"
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

function parseClickUpJoinDate(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const m = t.match(/,\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/i);
  if (!m) return null;
  const dt = DateTime.fromFormat(
    `${m[1]} ${m[2]} ${m[3]}`,
    "MMMM d yyyy",
    { zone: "utc" }
  );
  return dt.isValid ? dt.toFormat("yyyy-MM-dd") : null;
}

function isJunkTaskName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (n.includes("http://") || n.includes("https://")) return true;
  if (n.length > 80) return true;
  return false;
}

async function main() {
  const raw = fs.readFileSync(resolvedCsv, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  type CsvEntry = {
    taskName: string;
    displayName: string;
    joinDate: string | null;
  };

  const byName = new Map<string, CsvEntry>();

  for (const row of rows) {
    const taskName = (row["Task Name"] ?? "").trim();
    if (isJunkTaskName(taskName)) continue;

    const joinDateRaw = row["Join Date (date)"]?.trim();
    if (!joinDateRaw) continue;

    const joinDate = parseClickUpJoinDate(joinDateRaw);
    const displayName = formatPersonName(taskName);
    const key = normalizeCoachName(displayName);
    if (!key || byName.has(key)) continue;

    byName.set(key, { taskName, displayName, joinDate });
  }

  const { data: coaches, error } = await supabase
    .from("coaches")
    .select("id, slug, profiles!inner(full_name)");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const matchCandidates =
    coaches?.map((c) => ({
      slug: c.slug as string,
      fullName: formatPersonName(
        (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.full_name as string
      ),
    })) ?? [];

  const existingKeys = new Set(
    matchCandidates.map((c) => normalizeCoachName(c.fullName))
  );

  let created = 0;
  let skippedExisting = 0;
  let skippedNoDate = 0;

  const toImport: CsvEntry[] = [];
  for (const [, entry] of byName) {
    const key = normalizeCoachName(entry.displayName);
    if (existingKeys.has(key)) {
      skippedExisting++;
      continue;
    }
    if (matchCsvNameToCoach(entry.taskName, matchCandidates)) {
      skippedExisting++;
      continue;
    }
    toImport.push(entry);
  }

  skippedNoDate = rows.length - byName.size;

  console.log(`CSV unique names with dates: ${byName.size}`);
  console.log(`Already in DB (exact or smart match): ${skippedExisting}`);
  console.log(`${dryRun ? "Would create" : "Creating"} historical: ${toImport.length}`);

  for (const entry of toImport.sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  )) {
    if (dryRun) {
      console.log(
        `[dry-run] ${entry.displayName}  join=${entry.joinDate ?? "—"}`
      );
      created++;
      continue;
    }

    try {
      const result = await createHistoricalCoachRecord(supabase, {
        fullName: entry.displayName,
        joinDate: entry.joinDate,
        clickupTaskName: entry.taskName,
      });
      if (result.created) {
        console.log(
          `Created ${result.slug} (${entry.displayName}) join=${entry.joinDate ?? "—"}`
        );
        created++;
        matchCandidates.push({
          slug: result.slug,
          fullName: entry.displayName,
        });
        existingKeys.add(normalizeCoachName(entry.displayName));
      }
    } catch (err) {
      console.error(`Failed ${entry.displayName}:`, err);
      process.exit(1);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`${dryRun ? "Would create" : "Created"}: ${created}`);
  console.log(`Skipped (already in DB): ${skippedExisting}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

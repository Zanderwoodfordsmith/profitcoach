/**
 * Update coach join dates from ClickUp Coach Success export.
 * Writes to profiles.disco_community_joined_on (shown as "Join date" in admin).
 *
 * - Exact name match, then smart match (typos, nicknames, hyphenated surnames).
 * - Skips CSV rows with no join date (duplicate / placeholder tasks).
 * - Coaches in DB but not in CSV are left unchanged.
 * - Does not create new coach accounts (use --report-missing to list CSV-only names).
 *
 * Usage:
 *   npx tsx scripts/import-clickup-coach-join-dates-from-csv.ts --dry-run "/path/to/Coaches.csv"
 *   npx tsx scripts/import-clickup-coach-join-dates-from-csv.ts "/path/to/Coaches.csv"
 *   npx tsx scripts/import-clickup-coach-join-dates-from-csv.ts --report-fuzzy --dry-run "/path/to/file.csv"
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

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const reportMissing = argv.includes("--report-missing");
const reportFuzzy = argv.includes("--report-fuzzy");
const csvPath = argv.filter((a) => !a.startsWith("--")).at(0);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if (!csvPath?.trim()) {
  console.error(
    "Usage: npx tsx scripts/import-clickup-coach-join-dates-from-csv.ts [--dry-run] [--report-missing] <path-to.csv>"
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

type CsvRow = Record<string, string>;

/** e.g. "Tuesday, January 28th 2020" → yyyy-MM-dd */
function parseClickUpJoinDate(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;

  const m = t.match(/,\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/i);
  if (!m) return null;

  const monthName = m[1]!;
  const day = parseInt(m[2]!, 10);
  const year = parseInt(m[3]!, 10);
  const dt = DateTime.fromFormat(
    `${monthName} ${day} ${year}`,
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

type CoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  disco_community_joined_on: string | null;
};

async function main() {
  const raw = fs.readFileSync(resolvedCsv, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as CsvRow[];

  type CsvEntry = {
    taskName: string;
    displayName: string;
    joinDate: string;
    gender: string | null;
    contractAmount: string | null;
  };

  const byNormalizedName = new Map<string, CsvEntry>();
  let skippedNoDate = 0;
  let skippedJunk = 0;
  let skippedUnparseableDate = 0;

  for (const row of rows) {
    const taskName = (row["Task Name"] ?? "").trim();
    if (isJunkTaskName(taskName)) {
      skippedJunk++;
      continue;
    }

    const joinDateRaw = row["Join Date (date)"]?.trim();
    if (!joinDateRaw) {
      skippedNoDate++;
      continue;
    }

    const joinDate = parseClickUpJoinDate(joinDateRaw);
    if (!joinDate) {
      skippedUnparseableDate++;
      console.warn(`Could not parse date for "${taskName}": ${joinDateRaw}`);
      continue;
    }

    const displayName = formatPersonName(taskName);
    const key = normalizeCoachName(displayName);
    if (!key) continue;

    if (byNormalizedName.has(key)) {
      const existing = byNormalizedName.get(key)!;
      console.warn(
        `Duplicate name in CSV (keeping first): "${taskName}" vs "${existing.taskName}"`
      );
      continue;
    }

    byNormalizedName.set(key, {
      taskName,
      displayName,
      joinDate,
      gender: row["Gender (drop down)"]?.trim() || null,
      contractAmount: row["Contract Amount (currency)"]?.trim() || null,
    });
  }

  const { data: coaches, error } = await supabase
    .from("coaches")
    .select(
      "id, slug, profiles!inner(full_name, disco_community_joined_on)"
    )
    .order("slug");

  if (error) {
    console.error("Fetch coaches failed:", error.message);
    process.exit(1);
  }

  const coachRows: CoachRow[] = (coaches ?? []).map((c) => {
    const prof = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: c.id as string,
      slug: c.slug as string,
      full_name: (prof?.full_name as string | null) ?? null,
      disco_community_joined_on:
        (prof?.disco_community_joined_on as string | null) ?? null,
    };
  });

  const coachesByName = new Map<string, CoachRow[]>();
  for (const coach of coachRows) {
    const key = normalizeCoachName(formatPersonName(coach.full_name ?? ""));
    if (!key) continue;
    const list = coachesByName.get(key) ?? [];
    list.push(coach);
    coachesByName.set(key, list);
  }

  const matchCandidates = coachRows.map((c) => ({
    slug: c.slug,
    fullName: formatPersonName(c.full_name ?? ""),
  }));

  type MatchResult =
    | { kind: "exact"; coach: CoachRow }
    | { kind: "smart"; coach: CoachRow; dbName: string };

  function resolveCoachMatch(entry: CsvEntry): MatchResult | null {
    const key = normalizeCoachName(entry.displayName);
    const exact = coachesByName.get(key) ?? [];
    if (exact.length === 1) {
      return { kind: "exact", coach: exact[0]! };
    }
    if (exact.length > 1) return null;

    const smart = matchCsvNameToCoach(entry.taskName, matchCandidates);
    if (!smart) return null;

    const coach = coachRows.find((c) => c.slug === smart.slug);
    if (!coach) return null;

    return {
      kind: "smart",
      coach,
      dbName: smart.fullName,
    };
  }

  let updated = 0;
  let unchanged = 0;
  let ambiguous = 0;
  let smartMatched = 0;
  const smartMatches: Array<{
    csvName: string;
    dbName: string;
    slug: string;
    joinDate: string;
  }> = [];
  const unmatchedCsv: CsvEntry[] = [];
  const notInCsv: CoachRow[] = [];
  const matchedCoachIds = new Set<string>();

  for (const [, entry] of byNormalizedName) {
    const resolved = resolveCoachMatch(entry);
    if (!resolved) {
      const exact = coachesByName.get(normalizeCoachName(entry.displayName)) ?? [];
      if (exact.length > 1) {
        ambiguous++;
        console.warn(
          `Ambiguous DB match for "${entry.displayName}": ${exact.map((m) => m.slug).join(", ")}`
        );
      } else {
        unmatchedCsv.push(entry);
      }
      continue;
    }

    const coach = resolved.coach;
    matchedCoachIds.add(coach.id);

    if (resolved.kind === "smart") {
      smartMatched++;
      smartMatches.push({
        csvName: entry.displayName,
        dbName: resolved.dbName,
        slug: coach.slug,
        joinDate: entry.joinDate,
      });
    }

    const current = coach.disco_community_joined_on?.slice(0, 10) ?? null;
    if (current === entry.joinDate) {
      unchanged++;
      continue;
    }

    const smartNote =
      resolved.kind === "smart"
        ? ` [matched: CSV "${entry.displayName}" → DB "${resolved.dbName}"]`
        : "";
    console.log(
      `${dryRun ? "[dry-run] " : ""}Update ${coach.slug} (${resolved.kind === "smart" ? resolved.dbName : entry.displayName}): ${current ?? "—"} → ${entry.joinDate}${smartNote}`
    );

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ disco_community_joined_on: entry.joinDate })
        .eq("id", coach.id);

      if (updateError) {
        console.error(`Failed ${coach.slug}:`, updateError.message);
        process.exit(1);
      }
    }
    updated++;
  }

  for (const coach of coachRows) {
    if (!matchedCoachIds.has(coach.id)) {
      notInCsv.push(coach);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`CSV rows: ${rows.length}`);
  console.log(`CSV with join date (unique names): ${byNormalizedName.size}`);
  console.log(`Skipped (no date): ${skippedNoDate}`);
  console.log(`Skipped (junk name): ${skippedJunk}`);
  console.log(`Skipped (unparseable date): ${skippedUnparseableDate}`);
  console.log(`Coaches in DB: ${coachRows.length}`);
  console.log(`${dryRun ? "Would update" : "Updated"}: ${updated}`);
  console.log(`Smart name matches: ${smartMatched}`);
  console.log(`Already correct: ${unchanged}`);
  console.log(`Ambiguous (manual fix): ${ambiguous}`);
  console.log(`In CSV but not in DB: ${unmatchedCsv.length}`);
  console.log(`In DB but not in CSV (unchanged): ${notInCsv.length}`);

  if (reportFuzzy && smartMatches.length > 0) {
    console.log("\n--- Smart name matches ---");
    for (const f of smartMatches.sort((a, b) =>
      a.csvName.localeCompare(b.csvName)
    )) {
      console.log(
        `  CSV "${f.csvName}" → ${f.slug} (${f.dbName})  join ${f.joinDate}`
      );
    }
  }

  if (reportMissing && unmatchedCsv.length > 0) {
    console.log("\n--- CSV names not in DB ---");
    for (const e of unmatchedCsv.sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    )) {
      console.log(`  ${e.displayName}  joined ${e.joinDate}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

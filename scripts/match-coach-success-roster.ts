/**
 * Match ClickUp "Coach Success" roster CSV names to coaches in the app.
 * Helps assign legacy Stripe payments where customer email ≠ coach login email.
 *
 * Usage:
 *   npx tsx scripts/match-coach-success-roster.ts "/path/to/Coaches.csv"
 *   npx tsx scripts/match-coach-success-roster.ts --write-notes "/path/to/Coaches.csv"
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RosterRow = {
  taskName: string;
  joinDate: string;
  contractAmount: string;
};

type CoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
  email: string | null;
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(value: string): Set<string> {
  return new Set(
    normalizeName(value)
      .split(" ")
      .filter((t) => t.length > 1)
  );
}

function scoreNameMatch(rosterName: string, coach: CoachRow): number {
  const a = nameTokens(rosterName);
  const b = nameTokens(coach.full_name ?? coach.coach_business_name ?? "");
  if (a.size === 0 || b.size === 0) return 0;

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }

  const union = new Set([...a, ...b]).size;
  const jaccard = union > 0 ? overlap / union : 0;

  const rosterNorm = normalizeName(rosterName);
  const coachNorm = normalizeName(coach.full_name ?? "");
  if (rosterNorm && coachNorm && rosterNorm === coachNorm) {
    return 1;
  }

  if (overlap >= 2 && jaccard >= 0.5) {
    return 0.7 + jaccard * 0.3;
  }

  if (overlap === 1 && a.size <= 2 && b.size <= 2) {
    return 0.45;
  }

  return jaccard;
}

function parseRosterCsv(csvText: string): RosterRow[] {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  return records
    .map((row) => ({
      taskName: (row["Task Name"] ?? "").trim(),
      joinDate: (row["Join Date (date)"] ?? "").trim(),
      contractAmount: (row["Contract Amount (currency)"] ?? "").trim(),
    }))
    .filter(
      (row) =>
        row.taskName.length > 0 &&
        row.taskName !== "Task Name" &&
        /^[\p{L}\p{M}\s.'()-]+$/u.test(row.taskName)
    );
}

async function loadCoaches(
  supabase: ReturnType<typeof createClient>
): Promise<CoachRow[]> {
  const { data, error } = await supabase
    .from("coaches")
    .select("id, slug, profiles!inner(full_name, coach_business_name)")
    .order("slug");

  if (error) {
    throw new Error(`Load coaches: ${error.message}`);
  }

  const coaches: CoachRow[] =
    data?.map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id as string,
        slug: row.slug as string,
        full_name: (profile?.full_name as string | null) ?? null,
        coach_business_name:
          (profile?.coach_business_name as string | null) ?? null,
        email: null,
      };
    }) ?? [];

  const authUsers = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (!authUsers.error) {
    for (const user of authUsers.data.users ?? []) {
      const coach = coaches.find((c) => c.id === user.id);
      if (coach) {
        coach.email = user.email?.toLowerCase() ?? null;
      }
    }
  }

  return coaches;
}

async function main() {
  const writeNotes = process.argv.includes("--write-notes");
  const csvPath = process.argv
    .filter((a) => !a.startsWith("--") && /\.csv$/i.test(a))
    .at(0);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase env.");
    process.exit(1);
  }

  if (!csvPath?.trim()) {
    console.error(
      "Usage: npx tsx scripts/match-coach-success-roster.ts [--write-notes] <coaches-roster.csv>"
    );
    process.exit(1);
  }

  const resolved = path.resolve(csvPath.trim());
  const csvText = fs.readFileSync(resolved, "utf8");
  const roster = parseRosterCsv(csvText);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const coaches = await loadCoaches(supabase);

  let matched = 0;
  let ambiguous = 0;
  let unmatched = 0;

  console.log(`Roster: ${roster.length} names · App coaches: ${coaches.length}\n`);

  for (const entry of roster) {
    const scored = coaches
      .map((coach) => ({
        coach,
        score: scoreNameMatch(entry.taskName, coach),
      }))
      .filter((item) => item.score >= 0.45)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const second = scored[1];

    if (!best) {
      unmatched += 1;
      console.log(`✗ ${entry.taskName}`);
      console.log(`    join: ${entry.joinDate || "—"} · contract: ${entry.contractAmount || "—"}`);
      console.log("    → no coach match in app (create coach or assign payments manually)\n");
      continue;
    }

    const isAmbiguous =
      second && best.score - second.score < 0.15 && second.score >= 0.45;

    if (isAmbiguous) {
      ambiguous += 1;
      console.log(`? ${entry.taskName} (ambiguous)`);
      for (const item of scored.slice(0, 3)) {
        console.log(
          `    ${(item.score * 100).toFixed(0)}%  ${item.coach.full_name} (${item.coach.slug}) ${item.coach.email ?? ""}`
        );
      }
      console.log("");
      continue;
    }

    matched += 1;
    console.log(`✓ ${entry.taskName}`);
    console.log(
      `    → ${best.coach.full_name} (${best.coach.slug}) · ${best.coach.email ?? "no email"} · ${(best.score * 100).toFixed(0)}%`
    );
    if (entry.contractAmount) {
      console.log(`    contract: ${entry.contractAmount}`);
    }

    if (writeNotes) {
      const note = `Coach Success roster · join ${entry.joinDate || "?"}`;
      await supabase
        .from("coaches")
        .update({ crm_profile_name: entry.taskName })
        .eq("id", best.coach.id);
      console.log(`    (updated crm_profile_name on coach row)`);
    }
    console.log("");
  }

  console.log(
    `Summary: ${matched} matched, ${ambiguous} ambiguous, ${unmatched} unmatched`
  );
  console.log(
    "\nNext: import legacy Stripe CSV with npm run import-stripe-payments -- --dry-run <file>"
  );
  console.log(
    "Then assign unmatched payments in Admin → Payments using coach column (filter Unassigned)."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

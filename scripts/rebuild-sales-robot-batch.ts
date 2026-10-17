/**
 * Match Oct 7 Sales Robot CSVs to coaches, rank, and rebuild as archived campaigns.
 *
 *   npx tsx scripts/rebuild-sales-robot-batch.ts --plan
 *   npx tsx scripts/rebuild-sales-robot-batch.ts
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const DOWNLOADS = "/Users/zander/Downloads";
const TODAY = new Date("2026-10-17T00:00:00Z");
const RECENT_DAYS = 150;

const FILE_ALIAS: Record<string, string> = {
  "Campaign-Prospects_2026-10-07_10_29_37.csv": "adamwestbrook",
  "Campaign-Prospects-C1_CH61_50m_1&2_Construction_2026-10-07_10_13_07.csv":
    "peterbuglass",
  "Campaign-Prospects_2026-10-07_10_03_27.csv": "anycarr",
  "Campaign-Prospects_2026-10-07_09_56_19.csv": "sridharNarayan",
  "Campaign-Prospects-Equipment_Manufacturers_19July26_not_final_2026-10-07_09_51_15.csv":
    "markbladon",
  "Campaign-Prospects_2026-10-07_09_44_18.csv": "ianfinney",
  "Campaign-Prospects_2026-10-07_09_37_56.csv": "grahamCampbell",
  "Campaign-Prospects_2026-10-07_09_28_32.csv": "amerfashihi",
  "Campaign-Prospects_2026-10-07_09_27_42.csv": "allisonHogg",
  "Campaign-Prospects_2026-10-07_09_25_32.csv": "lukebiddle",
  "Campaign-Prospects-Scorecard_Campaign_2026-10-07_09_18_39.csv": "pam",
  "Campaign-Prospects_2026-10-07_08_58_08.csv": "Davidatkinson",
  "Campaign-Prospects_2026-10-07_08_53_15.csv": "Jonathanforster",
  "Campaign-Prospects_2026-10-07_08_48_07.csv": "Spencerthomas",
  "Campaign-Prospects_2026-10-07_08_42_40.csv": "Terencemonaghan",
  "Campaign-Prospects_2026-10-07_08_38_22.csv": "nunofontoura",
  "Campaign-Prospects_2026-10-07_08_33_27.csv": "annemelling",
  "Campaign-Prospects_2026-10-07_08_28_14.csv": "paulbiboud",
  "Campaign-Prospects_2026-10-07_08_23_34.csv": "matthewGeragthy",
  "Campaign-Prospects_2026-10-07_08_21_35.csv": "samuelbarlow",
  "Campaign-Prospects-Waco_5_County_-__10y_in_role_-_923_contacts_2026-10-07_08_13_52.csv":
    "Jeremeythompson",
  "Campaign-Prospects_2026-10-07_07_53_48.csv": "stefSolferini",
  "Campaign-Prospects_2026-10-07_07_36_44.csv": "CharlieBateson",
  "Campaign-Prospects_2026-10-07_07_31_40.csv": "ashleychivers",
  "Campaign-Prospects_2026-10-07_07_27_17.csv": "timjones",
  "Campaign-Prospects_2026-10-07_07_25_53.csv": "markcadbury",
  "Campaign-Prospects_2026-10-07_07_22_18.csv": "adamwestbrook-old",
  "Campaign-Prospects_2026-10-07_06_55_56.csv": "demo-export",
};

const ALIAS_HINTS: Record<string, string> = {
  adamwestbrook: "adam westbrook",
  peterbuglass: "peter buglass",
  anycarr: "andy carr",
  sridharnarayan: "sridhar narayanan",
  markbladon: "mark bladon",
  ianfinney: "ian finney",
  grahamcampbell: "graham campbell",
  amerfashihi: "amer fasihi",
  allisonhogg: "allison hogg",
  lukebiddle: "luke biddle",
  davidatkinson: "david atkinson",
  jonathanforster: "jonathan forster",
  spencerthomas: "spencer thomas",
  terencemonaghan: "terence monaghan",
  nunofontoura: "nuno fontoura",
  annemelling: "anne melling",
  paulbiboud: "paul biboud",
  matthewgeragthy: "matthew geraghty",
  samuelbarlow: "samuel barlow",
  jeremeythompson: "jeremy thompson",
  stefsolferini: "stefano solferini",
  charliebateson: "charlie bateson",
  ashleychivers: "ashley chivers",
  timjones: "tim jones",
  markcadbury: "mark cadbury",
  pam: "pam woodford",
};

const SKIP_ALIASES = new Set([
  "amerfashihi",
  "adamwestbrook-old",
  "demo-export",
  "markbladon",
  "Terencemonaghan",
  "adamwestbrook",
  "allisonHogg",
  "markcadbury",
  "matthewGeragthy",
  "peterbuglass",
  "Spencerthomas",
  "nunofontoura",
  "CharlieBateson",
  "ianfinney",
  "Jeremeythompson",
]);

function letters(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function daysBetween(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((TODAY.getTime() - d.getTime()) / 86400000);
}

type CoachRow = {
  id: string;
  slug: string;
  full_name: string;
  joined_at: string | null;
  recurring_payment_status: string | null;
  membership_status: string | null;
  linkedin_ok: boolean;
};

function isRecurring(coach: CoachRow): boolean {
  return ["monthly", "annual_prepaid", "first_6_months"].includes(
    coach.recurring_payment_status || ""
  );
}

function scoreMatch(alias: string, coach: CoachRow): number {
  const hint = ALIAS_HINTS[letters(alias)] || alias;
  const aliasLetters = letters(hint);
  const nameLetters = letters(coach.full_name);
  const slugLetters = letters(coach.slug);
  if (!aliasLetters) return 0;
  if (nameLetters === aliasLetters || slugLetters === aliasLetters) return 100;
  if (nameLetters.includes(aliasLetters) || aliasLetters.includes(nameLetters)) {
    return 90;
  }
  const hintParts = hint.toLowerCase().split(/\s+/).filter(Boolean);
  const nameParts = coach.full_name.toLowerCase().split(/\s+/).filter(Boolean);
  if (
    hintParts.length >= 2 &&
    nameParts.length >= 2 &&
    hintParts[0][0] === nameParts[0][0] &&
    hintParts[hintParts.length - 1] === nameParts[nameParts.length - 1]
  ) {
    return 80;
  }
  if (
    hintParts.length >= 2 &&
    nameParts.some((part) => part === hintParts[hintParts.length - 1])
  ) {
    return 55;
  }
  return 0;
}

async function loadCoaches() {
  const { createClient } = await import("@supabase/supabase-js");
  const { fetchAllSupabasePages } = await import(
    "../src/lib/contactsSchemaSafeSelect"
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const sb = createClient(url, key);

  const coachesPage = await fetchAllSupabasePages<{
    id: string;
    slug: string;
    recurring_payment_status: string | null;
    membership_status: string | null;
    profiles: {
      full_name: string | null;
      created_at: string | null;
      disco_community_joined_on: string | null;
    } | null;
  }>(async (from, to) =>
    sb
      .from("coaches")
      .select(
        "id, slug, recurring_payment_status, membership_status, profiles(full_name, created_at, disco_community_joined_on)"
      )
      .range(from, to)
  );

  const accountsPage = await fetchAllSupabasePages<{
    coach_id: string;
    status: string | null;
  }>(async (from, to) =>
    sb
      .from("linkedin_outreach_accounts")
      .select("coach_id, status")
      .eq("provider", "LINKEDIN")
      .range(from, to)
  );

  const linkedinOk = new Set(
    (accountsPage.data ?? [])
      .filter((row) => (row.status || "").toUpperCase() === "OK")
      .map((row) => row.coach_id)
  );

  const coaches: CoachRow[] = (coachesPage.data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      slug: row.slug,
      full_name: profile?.full_name || row.slug,
      joined_at:
        profile?.disco_community_joined_on || profile?.created_at || null,
      recurring_payment_status: row.recurring_payment_status,
      membership_status: row.membership_status,
      linkedin_ok: linkedinOk.has(row.id),
    };
  });
  return coaches;
}

type WorkItem = {
  file: string;
  alias: string;
  coach: CoachRow | null;
  score: number;
  skipReason: string | null;
  recent: boolean;
  recurring: boolean;
  daysAgo: number | null;
};

function rank(item: WorkItem): number {
  if (!item.coach || item.skipReason) return 999;
  if (item.recent && item.recurring && item.coach.linkedin_ok) return 1;
  if (item.recent && item.coach.linkedin_ok) return 2;
  if (item.recurring && item.coach.linkedin_ok) return 3;
  if (item.coach.linkedin_ok) return 4;
  if (item.recurring) return 5;
  return 6;
}

async function plan(): Promise<WorkItem[]> {
  const coaches = await loadCoaches();
  const items: WorkItem[] = [];

  for (const [file, alias] of Object.entries(FILE_ALIAS)) {
    const path = `${DOWNLOADS}/${file}`;
    if (!existsSync(path)) {
      items.push({
        file,
        alias,
        coach: null,
        score: 0,
        skipReason: "file missing",
        recent: false,
        recurring: false,
        daysAgo: null,
      });
      continue;
    }
    if (SKIP_ALIASES.has(alias)) {
      items.push({
        file,
        alias,
        coach: null,
        score: 0,
        skipReason:
          alias === "demo-export"
            ? "group-call demo export"
            : alias === "adamwestbrook-old"
              ? "older duplicate of Adam Westbrook"
              : "already rebuilt",
        recent: false,
        recurring: false,
        daysAgo: null,
      });
      continue;
    }
    const ranked = coaches
      .map((coach) => ({ coach, score: scoreMatch(alias, coach) }))
      .filter((row) => row.score >= 55)
      .sort((a, b) => b.score - a.score);
    const best = ranked[0] ?? null;
    const daysAgo = best ? daysBetween(best.coach.joined_at) : null;
    items.push({
      file,
      alias,
      coach: best?.coach ?? null,
      score: best?.score ?? 0,
      skipReason: best ? null : "no coach match",
      recent: daysAgo != null && daysAgo <= RECENT_DAYS,
      recurring: best ? isRecurring(best.coach) : false,
      daysAgo,
    });
  }

  return items.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (a.daysAgo ?? 9999) - (b.daysAgo ?? 9999);
  });
}

function printPlan(items: WorkItem[]) {
  console.log("\n=== Sales Robot rebuild plan ===\n");
  for (const item of items) {
    const name = item.coach?.full_name ?? "—";
    const slug = item.coach?.slug ?? "—";
    const flags = [
      item.recent ? "recent" : null,
      item.recurring ? "recurring" : null,
      item.coach?.linkedin_ok ? "linkedin" : item.coach ? "no-linkedin" : null,
      item.skipReason,
    ]
      .filter(Boolean)
      .join(" · ");
    console.log(
      `${item.alias.padEnd(22)} ${name.padEnd(28)} ${slug.padEnd(28)} ${flags}`
    );
  }
  const runnable = items.filter((item) => item.coach && !item.skipReason);
  const unmatched = items.filter(
    (item) => !item.coach || item.skipReason?.includes("match") || item.skipReason?.includes("plus")
  );
  console.log(`\nRunnable: ${runnable.length}`);
  console.log(`Need a name from you: ${unmatched.length}`);
}

async function main() {
  const items = await plan();
  printPlan(items);
  if (process.argv.includes("--plan")) return;

  const runnable = items.filter((item) => item.coach && !item.skipReason);
  for (const item of runnable) {
    const csv = `${DOWNLOADS}/${item.file}`;
    console.log(`\n-------- ${item.coach!.full_name} (${item.coach!.slug}) --------`);
    const result = spawnSync(
      "npx",
      [
        "tsx",
        "scripts/rebuild-sales-robot-campaigns.ts",
        "--csv",
        csv,
        "--coach-slug",
        item.coach!.slug,
      ],
      { stdio: "inherit", cwd: process.cwd() }
    );
    if (result.status !== 0) {
      console.error(`FAILED ${item.coach!.slug} exit ${result.status}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Merge duplicate coach records: reassign data to keeper, delete duplicate.
 *
 * Usage:
 *   npx tsx scripts/merge-duplicate-coaches.ts --dry-run
 *   npx tsx scripts/merge-duplicate-coaches.ts
 */

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** keepId ← removeId (remove is deleted after reassignment) */
const MERGE_PLANS: Array<{ label: string; keepId: string; removeId: string }> = [
  {
    label: "Samuel Barlow (keep logged-in samuel-b)",
    keepId: "a543c9f2-0875-4246-bf7e-83c831c231a7",
    removeId: "6ab96945-ad66-4a27-a88a-3fa8467556c3",
  },
  {
    label: "Sue Gallagher (keep logged-in susan)",
    keepId: "250d7ad7-79a5-4f5e-a908-77642dce5fd8",
    removeId: "1f9a9c1a-3f40-45e5-bf69-5181e46007ca",
  },
  {
    label: "Andy Garner (keep andygarner, more payments)",
    keepId: "9f5def7c-13a5-417a-9d5e-c6edcbc4b5af",
    removeId: "5c71ae3a-3516-47d6-8d0e-aadac772ae8c",
  },
  {
    label: "Patrick Riley (keep logged-in patrick-riley)",
    keepId: "11b024d1-3430-4063-a795-7900bcdd5df8",
    removeId: "69c8bc0d-33b7-4eac-a5e2-a98c551eaeb3",
  },
  {
    label: "Perry Gale (keep perrygale, has payment)",
    keepId: "73d2cca6-c493-46a1-9124-906d40d75f97",
    removeId: "42339ea5-cfb4-414d-8a2e-b2c444edb054",
  },
  {
    label: "Belal Al-Khatib (keep belal, has payment)",
    keepId: "8eb6921c-d0e8-4a04-8092-853408b87afc",
    removeId: "4a8083f5-2719-405d-9cae-96cfea301d7c",
  },
  {
    label: "Scott Geller (keep scott-d-geller, has payment)",
    keepId: "3ab5c10a-e253-4bf6-aada-77587fcae6da",
    removeId: "d9883684-f4a4-47ae-97a9-1c2be82f5438",
  },
  {
    label: "Richard Carter (keep rktcarter)",
    keepId: "da985ee9-cf91-47f0-b550-78bd902810eb",
    removeId: "5ffa8f02-a170-48e2-a14e-1d74288a498b",
  },
  {
    label: "Marina Bleehan (keep hist-marina-bleahen, has payments)",
    keepId: "371d2052-57ed-4aaa-97b1-443266f02ec1",
    removeId: "59f7ebae-229b-4254-95ac-7c8173710741",
  },
];

async function reassignColumn(
  supabase: SupabaseClient,
  table: string,
  column: string,
  fromId: string,
  toId: string,
  dryRun: boolean
): Promise<number> {
  const { count, error: countError } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, fromId);

  if (countError) {
    if (countError.code === "42P01") return 0;
    throw new Error(`${table} count: ${countError.message}`);
  }

  const n = count ?? 0;
  if (n === 0) return 0;

  if (!dryRun) {
    const { error } = await supabase
      .from(table)
      .update({ [column]: toId })
      .eq(column, fromId);
    if (error) {
      throw new Error(`${table} update: ${error.message}`);
    }
  }

  return n;
}

async function mergeLadderAchievements(
  supabase: SupabaseClient,
  keepId: string,
  removeId: string,
  dryRun: boolean
): Promise<{ moved: number; dropped: number }> {
  const { data: rows, error } = await supabase
    .from("community_ladder_achievements")
    .select("level_id, achieved_on")
    .eq("user_id", removeId);

  if (error) {
    if (error.code === "42P01") return { moved: 0, dropped: 0 };
    throw new Error(`ladder fetch: ${error.message}`);
  }

  let moved = 0;
  let dropped = 0;

  for (const row of rows ?? []) {
    const { data: existing } = await supabase
      .from("community_ladder_achievements")
      .select("user_id")
      .eq("user_id", keepId)
      .eq("level_id", row.level_id)
      .maybeSingle();

    if (existing) {
      dropped += 1;
      if (!dryRun) {
        await supabase
          .from("community_ladder_achievements")
          .delete()
          .eq("user_id", removeId)
          .eq("level_id", row.level_id);
      }
      continue;
    }

    moved += 1;
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("community_ladder_achievements")
        .update({ user_id: keepId })
        .eq("user_id", removeId)
        .eq("level_id", row.level_id);
      if (updateError) {
        throw new Error(`ladder update: ${updateError.message}`);
      }
    }
  }

  return { moved, dropped };
}

async function mergeScorecardWeeks(
  supabase: SupabaseClient,
  keepId: string,
  removeId: string,
  dryRun: boolean
): Promise<{ moved: number; dropped: number }> {
  const { data: rows, error } = await supabase
    .from("coach_scorecard_week")
    .select("week_start_date")
    .eq("user_id", removeId);

  if (error) {
    if (error.code === "42P01") return { moved: 0, dropped: 0 };
    throw new Error(`scorecard fetch: ${error.message}`);
  }

  let moved = 0;
  let dropped = 0;

  for (const row of rows ?? []) {
    const { data: existing } = await supabase
      .from("coach_scorecard_week")
      .select("user_id")
      .eq("user_id", keepId)
      .eq("week_start_date", row.week_start_date)
      .maybeSingle();

    if (existing) {
      dropped += 1;
      if (!dryRun) {
        await supabase
          .from("coach_scorecard_week")
          .delete()
          .eq("user_id", removeId)
          .eq("week_start_date", row.week_start_date);
      }
      continue;
    }

    moved += 1;
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("coach_scorecard_week")
        .update({ user_id: keepId })
        .eq("user_id", removeId)
        .eq("week_start_date", row.week_start_date);
      if (updateError) {
        throw new Error(`scorecard update: ${updateError.message}`);
      }
    }
  }

  return { moved, dropped };
}

async function deleteCoach(
  supabase: SupabaseClient,
  coachId: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) return;

  const { error: coachError } = await supabase
    .from("coaches")
    .delete()
    .eq("id", coachId);
  if (coachError) {
    throw new Error(`delete coaches: ${coachError.message}`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", coachId);
  if (profileError) {
    throw new Error(`delete profiles: ${profileError.message}`);
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(coachId);
  if (authError) {
    throw new Error(`delete auth user: ${authError.message}`);
  }
}

async function mergePair(
  supabase: SupabaseClient,
  plan: (typeof MERGE_PLANS)[number],
  dryRun: boolean
): Promise<boolean> {
  const { label, keepId, removeId } = plan;

  const { data: removeCoach, error: removeLookupError } = await supabase
    .from("coaches")
    .select("id")
    .eq("id", removeId)
    .maybeSingle();
  if (removeLookupError) {
    throw new Error(`lookup remove coach: ${removeLookupError.message}`);
  }
  if (!removeCoach) {
    console.log(`\n=== ${label} ===`);
    console.log(`  skip (duplicate ${removeId} already removed)`);
    return false;
  }

  console.log(`\n=== ${label} ===`);
  console.log(`  keep   ${keepId}`);
  console.log(`  remove ${removeId}`);

  const payments = await reassignColumn(
    supabase,
    "coach_payments",
    "coach_id",
    removeId,
    keepId,
    dryRun
  );
  const contacts = await reassignColumn(
    supabase,
    "contacts",
    "coach_id",
    removeId,
    keepId,
    dryRun
  );
  const revenue = await reassignColumn(
    supabase,
    "coach_revenue_lines",
    "coach_id",
    removeId,
    keepId,
    dryRun
  );
  const assessments = await reassignColumn(
    supabase,
    "assessments",
    "coach_id",
    removeId,
    keepId,
    dryRun
  );

  const ladder = await mergeLadderAchievements(supabase, keepId, removeId, dryRun);
  const scorecard = await mergeScorecardWeeks(supabase, keepId, removeId, dryRun);

  console.log(
    `  reassigned: payments=${payments}, contacts=${contacts}, revenue_lines=${revenue}, assessments=${assessments}`
  );
  console.log(
    `  ladder: moved=${ladder.moved}, dropped=${ladder.dropped}; scorecard: moved=${scorecard.moved}, dropped=${scorecard.dropped}`
  );

  await deleteCoach(supabase, removeId, dryRun);
  console.log(dryRun ? "  would delete duplicate coach + auth user" : "  deleted duplicate coach + auth user");
  return true;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg?.slice("--only=".length).toLowerCase();

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase env.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const plans = only
    ? MERGE_PLANS.filter((plan) => plan.label.toLowerCase().includes(only))
    : MERGE_PLANS;

  if (plans.length === 0) {
    console.error(`No merge plans match --only=${only ?? ""}`);
    process.exit(1);
  }

  console.log(dryRun ? "DRY RUN" : "EXECUTING MERGES");
  console.log(`${plans.length} merge(s) planned${only ? ` (filter: ${only})` : ""}`);

  for (const plan of plans) {
    await mergePair(supabase, plan, dryRun);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Give every coach seen in the last 30 days a Blueprint record, filled from
 * their welcome form and LinkedIn snapshot the same way opening the page does.
 * "Seen" = signed in, or used the app, in the window.
 *
 *   npx tsx scripts/backfill-coach-blueprints.ts --dry-run [--days 30]
 *   npx tsx scripts/backfill-coach-blueprints.ts [--days 30]
 *
 * Never scrapes LinkedIn. Coaches who already have a record are left alone.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function arg(flag: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] ?? null : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const days = Number(arg("--days") ?? 30);
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { hydratePracticeFromProfile } = await import(
    "../src/lib/practiceKnowledge/hydrate"
  );

  const seen = new Set<string>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const user of data.users) {
      const at = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN;
      if (at >= sinceMs) seen.add(user.id);
    }
    if (data.users.length < 1000) break;
  }
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("app_usage_sessions")
      .select("user_id")
      .gte("last_activity_at", sinceIso)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) seen.add(row.user_id as string);
    if ((data ?? []).length < 1000) break;
  }

  const ids = [...seen];
  const coaches: Array<{ id: string; full_name: string | null }> = [];
  const withBlueprint = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const [profiles, existing] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").eq("role", "coach").in("id", chunk),
      supabaseAdmin.from("coach_practice_knowledge").select("coach_id").in("coach_id", chunk),
    ]);
    if (profiles.error) throw new Error(profiles.error.message);
    if (existing.error) throw new Error(existing.error.message);
    coaches.push(...((profiles.data ?? []) as typeof coaches));
    for (const row of existing.data ?? []) withBlueprint.add(row.coach_id as string);
  }

  const missing = coaches.filter((c) => !withBlueprint.has(c.id));
  console.log(
    `${coaches.length} coaches seen in the last ${days} days; ${coaches.length - missing.length} already have a Blueprint; ${missing.length} to create.`
  );
  for (const c of missing) console.log(`  ${c.full_name ?? "(no name)"}  ${c.id}`);
  if (dryRun) return;

  let created = 0;
  for (const c of missing) {
    try {
      await hydratePracticeFromProfile(c.id);
      created += 1;
    } catch (err) {
      console.error(`  failed ${c.id}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`Created ${created} of ${missing.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

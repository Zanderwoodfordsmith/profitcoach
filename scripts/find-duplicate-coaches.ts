/**
 * List likely duplicate coaches and related counts.
 *
 * Usage:
 *   npx tsx scripts/find-duplicate-coaches.ts
 *   npx tsx scripts/find-duplicate-coaches.ts --search barlow
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type CoachRow = {
  id: string;
  slug: string;
  profiles: {
    full_name: string | null;
    coach_business_name: string | null;
    created_at: string | null;
    linkedin_url: string | null;
    bio: string | null;
  };
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameKey(fullName: string | null, businessName: string | null): string {
  const raw = (fullName ?? businessName ?? "").trim();
  if (!raw) return "";
  return normalizeName(raw);
}

async function main() {
  const searchArg = process.argv.find((a) => a.startsWith("--search="));
  const search = searchArg?.slice("--search=".length).toLowerCase();

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase env.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: coaches, error } = await supabase
    .from("coaches")
    .select(
      "id, slug, profiles!inner(full_name, coach_business_name, created_at, linkedin_url, bio)"
    )
    .order("slug");

  if (error) {
    console.error("Fetch coaches failed:", error.message);
    process.exit(1);
  }

  const rows: CoachRow[] =
    coaches?.map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id as string,
        slug: row.slug as string,
        profiles: {
          full_name: (profile?.full_name as string | null) ?? null,
          coach_business_name: (profile?.coach_business_name as string | null) ?? null,
          created_at: (profile?.created_at as string | null) ?? null,
          linkedin_url: (profile?.linkedin_url as string | null) ?? null,
          bio: (profile?.bio as string | null) ?? null,
        },
      };
    }) ?? [];
  const authUsers = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const lastSignIn = new Map<string, string | null>();
  const emailById = new Map<string, string | null>();
  for (const user of authUsers.data.users ?? []) {
    lastSignIn.set(user.id, user.last_sign_in_at ?? null);
    emailById.set(user.id, user.email ?? null);
  }

  type Enriched = CoachRow & {
    email: string | null;
    payments: number;
    contacts: number;
    last_sign_in_at: string | null;
    infoScore: number;
  };

  const enriched: Enriched[] = [];
  for (const row of rows) {
    const { count: payments } = await supabase
      .from("coach_payments")
      .select("*", { count: "exact", head: true })
      .eq("coach_id", row.id);
    const { count: contacts } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("coach_id", row.id);

    const p = row.profiles;
    let infoScore = 0;
    if (p.full_name) infoScore += 2;
    if (p.coach_business_name) infoScore += 1;
    const email = emailById.get(row.id) ?? null;
    if (email) infoScore += 1;
    if (p.linkedin_url) infoScore += 1;
    if (p.bio) infoScore += 1;
    if (lastSignIn.get(row.id)) infoScore += 5;

    enriched.push({
      ...row,
      email,
      payments: payments ?? 0,
      contacts: contacts ?? 0,
      last_sign_in_at: lastSignIn.get(row.id) ?? null,
      infoScore,
    });
  }

  const filtered = search
    ? enriched.filter((row) => {
        const hay = `${row.slug} ${row.profiles.full_name} ${row.profiles.coach_business_name} ${row.email}`.toLowerCase();
        return hay.includes(search);
      })
    : enriched;

  const byName = new Map<string, Enriched[]>();
  for (const row of enriched) {
    const key = nameKey(row.profiles.full_name, row.profiles.coach_business_name);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(row);
    byName.set(key, list);
  }

  const duplicates = [...byName.entries()].filter(([, list]) => list.length > 1);

  console.log(`\n=== Duplicate name groups (${duplicates.length}) ===\n`);
  for (const [key, list] of duplicates.sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`— ${key} (${list.length})`);
    for (const row of list.sort((a, b) => b.infoScore - a.infoScore || b.payments - a.payments)) {
      console.log(
        `    ${row.profiles.full_name ?? "(no name)"} | slug=${row.slug} | id=${row.id}`
      );
      console.log(
        `      email=${row.email ?? "—"} | payments=${row.payments} | contacts=${row.contacts} | last_sign_in=${row.last_sign_in_at ?? "never"} | score=${row.infoScore}`
      );
    }
    console.log("");
  }

  if (search) {
    console.log(`\n=== Matches for "${search}" ===\n`);
    for (const row of filtered) {
      console.log(
        `${row.profiles.full_name} | slug=${row.slug} | id=${row.id} | payments=${row.payments} | last_sign_in=${row.last_sign_in_at ?? "never"}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

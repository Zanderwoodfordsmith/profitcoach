/**
 * Deactivate Mark James / Zac Fagan logins and delete empty test accounts.
 *
 * Keeps Mark + Zac main profiles (community authorship).
 * Bans their auth users and deletes Mark's test account + Zac orphan auth users.
 *
 * Usage:
 *   npx tsx scripts/deactivate-former-staff.ts
 *   npx tsx scripts/deactivate-former-staff.ts --dry-run
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

/** Keep profiles; ban login only. */
const BAN_AND_KEEP = [
  {
    id: "9fa4ceb3-7605-42e2-b9a8-dd923814eac3",
    label: "Mark James (main)",
  },
  {
    id: "4713d7f7-5733-4fcb-8559-4ad3befacffb",
    label: "Zac Fagan (main)",
  },
] as const;

/** Safe to fully remove (no community posts/comments). */
const DELETE_FULLY = [
  {
    id: "51422da4-a05b-445a-89b3-1715261d58b8",
    label: "Mark James Test Account",
  },
] as const;

/** Auth-only leftovers (no profiles). */
const DELETE_AUTH_ONLY = [
  {
    id: "a7f49057-1586-4011-9518-73ffe823b440",
    label: "zacfag+tes+testt@gmail.com",
  },
  {
    id: "6966868e-c66a-4b4e-81f0-87a3c865d7df",
    label: "zacfag+test@gmail.com",
  },
  {
    id: "da47d83e-4567-4efa-bcb9-9e0c7bfcb61f",
    label: "zacfag@gmail.com",
  },
] as const;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function banUser(id: string, label: string) {
  console.log(`${dryRun ? "[dry-run] " : ""}Ban login: ${label} (${id})`);
  if (dryRun) return;
  const { error } = await sb.auth.admin.updateUserById(id, {
    ban_duration: "876000h",
  });
  if (error) throw new Error(`Ban failed for ${label}: ${error.message}`);
}

async function deleteCoachProfileAuth(id: string, label: string) {
  console.log(
    `${dryRun ? "[dry-run] " : ""}Delete coach+profile+auth: ${label} (${id})`
  );
  if (dryRun) return;

  const { count: posts } = await sb
    .from("community_posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", id);
  const { count: comments } = await sb
    .from("community_post_comments")
    .select("id", { count: "exact", head: true })
    .eq("author_id", id);
  if ((posts ?? 0) > 0 || (comments ?? 0) > 0) {
    throw new Error(
      `Refusing to delete ${label}: has ${posts} posts / ${comments} comments`
    );
  }

  const { error: coachErr } = await sb.from("coaches").delete().eq("id", id);
  if (coachErr) {
    throw new Error(`Delete coaches failed for ${label}: ${coachErr.message}`);
  }
  const { error: profileErr } = await sb.from("profiles").delete().eq("id", id);
  if (profileErr) {
    throw new Error(
      `Delete profiles failed for ${label}: ${profileErr.message}`
    );
  }
  const { error: authErr } = await sb.auth.admin.deleteUser(id);
  if (authErr) {
    throw new Error(`Delete auth failed for ${label}: ${authErr.message}`);
  }
}

async function deleteAuthOnly(id: string, label: string) {
  console.log(`${dryRun ? "[dry-run] " : ""}Delete auth only: ${label} (${id})`);
  if (dryRun) return;

  const { data: profile } = await sb
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (profile) {
    throw new Error(
      `Refusing auth-only delete for ${label}: profile still exists`
    );
  }

  const { error } = await sb.auth.admin.deleteUser(id);
  if (error) {
    // Already gone is fine
    if (!/not found|user not found/i.test(error.message)) {
      throw new Error(`Delete auth failed for ${label}: ${error.message}`);
    }
    console.log(`  (already gone)`);
  }
}

async function main() {
  for (const row of BAN_AND_KEEP) {
    await banUser(row.id, row.label);
  }
  for (const row of DELETE_FULLY) {
    await deleteCoachProfileAuth(row.id, row.label);
  }
  for (const row of DELETE_AUTH_ONLY) {
    await deleteAuthOnly(row.id, row.label);
  }
  console.log(dryRun ? "Dry run complete." : "Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

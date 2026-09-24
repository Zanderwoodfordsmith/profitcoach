/**
 * Copy a coach's existing prospects (contacts) into their Pool so they show
 * up under Campaigns → Pool. Prospects stay where they are; each pool row is
 * linked back via contact_id. People already in the pool are skipped.
 *
 * Usage:
 *   npx tsx scripts/backfill-pool-from-prospects.ts \
 *     --coach-id <uuid> \
 *     --prospect-source sales_navigator \
 *     [--pool-source sales_nav] [--dry-run]
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { poolIdentityKey } from "../src/lib/pool/identity";
import { normalizeLinkedInProfileUrl } from "../src/lib/unipile/linkedinUrl";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const INSERT_CHUNK = 200;

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const dryRun = process.argv.includes("--dry-run");
const coachId = argValue("--coach-id")?.trim();
const prospectSource = argValue("--prospect-source")?.trim() || null;
const poolSource = argValue("--pool-source")?.trim() || "sales_nav";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}
if (!coachId) {
  console.error(
    "Usage: npx tsx scripts/backfill-pool-from-prospects.ts --coach-id <uuid> [--prospect-source <source>] [--pool-source sales_nav] [--dry-run]"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type ContactRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  business_name: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  company_website: string | null;
  headline: string | null;
  location: string | null;
  photo_url: string | null;
  prospect_source: string | null;
  created_at: string | null;
};

async function loadAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function main() {
  const { data: pool, error: poolError } = await supabase
    .from("coach_lead_lists")
    .select("id")
    .eq("coach_id", coachId)
    .eq("kind", "pool")
    .maybeSingle();
  if (poolError || !pool?.id) {
    throw new Error(`No pool list for coach ${coachId}: ${poolError?.message ?? "missing"}`);
  }
  const poolId = pool.id as string;

  const contacts = await loadAll<ContactRow>((from, to) => {
    let q = supabase
      .from("contacts")
      .select(
        "id, full_name, first_name, last_name, job_title, business_name, linkedin_url, email, phone, company_website, headline, location, photo_url, prospect_source, created_at"
      )
      .eq("coach_id", coachId)
      .eq("type", "prospect")
      .order("created_at", { ascending: true })
      .range(from, to);
    if (prospectSource) q = q.eq("prospect_source", prospectSource);
    return q;
  });

  const existing = await loadAll<{ identity_key: string | null; linkedin_url: string | null; contact_id: string | null }>(
    (from, to) =>
      supabase
        .from("coach_lead_list_items")
        .select("identity_key, linkedin_url, contact_id")
        .eq("list_id", poolId)
        .range(from, to)
  );
  const seenKeys = new Set(existing.map((r) => r.identity_key).filter(Boolean) as string[]);
  const seenUrls = new Set(
    existing
      .map((r) => normalizeLinkedInProfileUrl(r.linkedin_url ?? ""))
      .filter(Boolean) as string[]
  );
  const seenContacts = new Set(existing.map((r) => r.contact_id).filter(Boolean) as string[]);

  let skippedExisting = 0;
  let invalid = 0;
  const rows: Record<string, unknown>[] = [];
  for (const c of contacts) {
    const linkedin = normalizeLinkedInProfileUrl(c.linkedin_url ?? "");
    const identity = poolIdentityKey({
      linkedin_url: linkedin,
      email: c.email,
      phone: c.phone,
      website: c.company_website,
    });
    if (!identity) {
      invalid += 1;
      continue;
    }
    if (seenKeys.has(identity) || (linkedin && seenUrls.has(linkedin)) || seenContacts.has(c.id)) {
      skippedExisting += 1;
      continue;
    }
    seenKeys.add(identity);
    if (linkedin) seenUrls.add(linkedin);
    seenContacts.add(c.id);

    const fullName =
      c.full_name?.trim() ||
      [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
      null;
    rows.push({
      list_id: poolId,
      coach_id: coachId,
      source: poolSource,
      full_name: fullName,
      first_name: c.first_name,
      last_name: c.last_name,
      job_title: c.job_title,
      company: c.business_name,
      linkedin_url: linkedin,
      email: c.email?.trim().toLowerCase() || null,
      phone: c.phone,
      website: c.company_website,
      identity_key: identity,
      contact_id: c.id,
      match_reason: "Sales Navigator",
      raw: {
        prospect: {
          headline: c.headline,
          location: c.location,
          photo_url: c.photo_url,
          prospect_source: c.prospect_source,
          imported_at: c.created_at,
        },
      },
      created_at: c.created_at ?? undefined,
    });
  }

  console.log(
    `Coach ${coachId}\nPool ${poolId} (currently ${existing.length})\nProspects matched: ${contacts.length}\nTo add: ${rows.length}\nAlready in pool: ${skippedExisting}\nNo identity: ${invalid}\nMode: ${dryRun ? "dry-run" : "write"}`
  );
  if (dryRun || !rows.length) return;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from("coach_lead_list_items").insert(chunk);
    if (error) throw new Error(`Insert failed at ${i}: ${error.message}`);
    inserted += chunk.length;
    process.stdout.write(`\rInserted ${inserted}/${rows.length}`);
  }

  const { count } = await supabase
    .from("coach_lead_list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", poolId);
  await supabase
    .from("coach_lead_lists")
    .update({ item_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq("id", poolId);

  console.log(`\nDone. inserted=${inserted} pool_total=${count ?? "?"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

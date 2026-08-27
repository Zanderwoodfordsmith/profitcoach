/**
 * Transfer Sales Navigator prospects between coaches and enrich from leadrocks_leads.
 *
 * Usage:
 *   npx tsx scripts/transfer-sales-nav-prospects.ts \
 *     --from-slug adam --to-slug adam-msw
 *
 *   npx tsx scripts/transfer-sales-nav-prospects.ts \
 *     --from-coach-id ... --to-coach-id ... --source sales_navigator
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import type { ProspectLeadrocksEnrichment } from "../src/lib/prospects/matchLeadrocksLead";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const dryRun = process.argv.includes("--dry-run");
const fromSlug = argValue("--from-slug")?.trim();
const toSlug = argValue("--to-slug")?.trim();
const fromCoachId = argValue("--from-coach-id")?.trim();
const toCoachId = argValue("--to-coach-id")?.trim();
const source = argValue("--source")?.trim() || "sales_navigator";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if ((!fromSlug && !fromCoachId) || (!toSlug && !toCoachId)) {
  console.error(
    "Usage: npx tsx scripts/transfer-sales-nav-prospects.ts --from-slug <slug> --to-slug <slug> [--source sales_navigator] [--dry-run]"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolveCoachId(
  slug: string | undefined,
  id: string | undefined,
  label: string
): Promise<string> {
  if (id) return id;
  if (!slug) throw new Error(`Missing ${label} coach id or slug`);
  const { data, error } = await supabase
    .from("coaches")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data?.id) {
    throw new Error(`Coach not found for slug "${slug}"`);
  }
  return data.id as string;
}

function mergeEnrichment(
  contact: {
    email: string | null;
    phone: string | null;
    job_title: string | null;
    business_name: string | null;
    linkedin_url: string | null;
  },
  enrichment: ProspectLeadrocksEnrichment
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (!contact.email?.trim() && enrichment.email) patch.email = enrichment.email;
  if (!contact.phone?.trim() && enrichment.phone) patch.phone = enrichment.phone;
  if (!contact.job_title?.trim() && enrichment.job_title) {
    patch.job_title = enrichment.job_title;
  }
  if (!contact.business_name?.trim() && enrichment.business_name) {
    patch.business_name = enrichment.business_name;
  }
  if (enrichment.linkedin_url) {
    patch.linkedin_url = enrichment.linkedin_url;
  }
  return patch;
}

async function main() {
  const { enrichProspectFromLeadrocks } = await import(
    "../src/lib/prospects/matchLeadrocksLead"
  );

  const fromId = await resolveCoachId(fromSlug, fromCoachId, "from");
  const toId = await resolveCoachId(toSlug, toCoachId, "to");

  console.log(
    `Transfer prospects (source=${source})\n  from: ${fromSlug ?? fromId}\n  to: ${toSlug ?? toId}\n  mode: ${dryRun ? "dry-run" : "live"}`
  );

  const { data: prospects, error } = await supabase
    .from("contacts")
    .select(
      "id, full_name, first_name, last_name, email, phone, job_title, business_name, linkedin_url, prospect_source"
    )
    .eq("coach_id", fromId)
    .eq("type", "prospect")
    .eq("prospect_source", source);

  if (error) {
    console.error("Failed to load prospects:", error.message);
    process.exit(1);
  }

  const rows = prospects ?? [];
  console.log(`Found ${rows.length} prospect(s) to transfer.`);

  let transferred = 0;
  let merged = 0;
  let deleted = 0;
  let enriched = 0;
  let enrichMiss = 0;

  for (const row of rows) {
    const linkedin = (row.linkedin_url as string | null)?.trim() || null;

    const enrichment = await enrichProspectFromLeadrocks({
      linkedin_url: linkedin,
      full_name: row.full_name as string,
      first_name: row.first_name as string | null,
      last_name: row.last_name as string | null,
      business_name: row.business_name as string | null,
    });

    const enrichPatch = enrichment
      ? mergeEnrichment(
          {
            email: (row.email as string | null) ?? null,
            phone: (row.phone as string | null) ?? null,
            job_title: (row.job_title as string | null) ?? null,
            business_name: (row.business_name as string | null) ?? null,
            linkedin_url: linkedin,
          },
          enrichment
        )
      : {};

    if (enrichment) {
      enriched += 1;
      if (enrichment.email || enrichment.phone) {
        console.log(
          `  enrich ${row.full_name}: email=${enrichment.email ?? "—"} phone=${enrichment.phone ?? "—"} web=${enrichment.company_website ?? "—"}`
        );
      }
    } else {
      enrichMiss += 1;
    }

    let targetId = row.id as string;
    let existingOnTarget: { id: string } | null = null;

    if (linkedin) {
      const { data: dup } = await supabase
        .from("contacts")
        .select("id")
        .eq("coach_id", toId)
        .eq("linkedin_url", linkedin)
        .maybeSingle();
      existingOnTarget = dup ?? null;
    }

    if (existingOnTarget && existingOnTarget.id !== row.id) {
      if (!dryRun) {
        const { error: mergeError } = await supabase
          .from("contacts")
          .update({
            ...enrichPatch,
            prospect_source: source,
            type: "prospect",
          })
          .eq("id", existingOnTarget.id);
        if (mergeError) {
          console.error(`Merge failed for ${row.full_name}:`, mergeError.message);
          continue;
        }
        const { error: deleteError } = await supabase
          .from("contacts")
          .delete()
          .eq("id", row.id);
        if (deleteError) {
          console.error(`Delete duplicate failed for ${row.full_name}:`, deleteError.message);
          continue;
        }
      }
      merged += 1;
      deleted += 1;
      continue;
    }

    if (!dryRun) {
      const { error: moveError } = await supabase
        .from("contacts")
        .update({
          coach_id: toId,
          ...enrichPatch,
        })
        .eq("id", row.id);
      if (moveError) {
        console.error(`Transfer failed for ${row.full_name}:`, moveError.message);
        continue;
      }
    }
    transferred += 1;
  }

  console.log(
    `\nDone. transferred=${transferred} merged_into_existing=${merged} removed_dupes=${deleted} enriched=${enriched} no_leadrocks_match=${enrichMiss}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

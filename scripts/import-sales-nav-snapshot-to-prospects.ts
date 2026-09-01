/**
 * Import leads from a sales_nav_import_runs.lead_snapshot into a coach's prospects.
 * Enriches from leadrocks_leads (email, phone, vanity LinkedIn) when available.
 *
 * Usage:
 *   npx tsx scripts/import-sales-nav-snapshot-to-prospects.ts \
 *     --run-name "Uk Plumbers" \
 *     --coach-slug adam-msw
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { normalizeLinkedInProfileUrl } from "../src/lib/apify/linkedinProfile";
import type { SalesNavImportedLead } from "../src/lib/apify/salesNavigatorTypes";
import {
  normalizeProspectLabel,
  normalizeProspectPersonName,
} from "../src/lib/prospectDisplayFormat";
import {
  enrichmentPatchFromLeadrocks,
  type ProspectLeadrocksEnrichment,
} from "../src/lib/prospects/matchLeadrocksLead";
import {
  canonicalLinkedInProfileUrl,
  normalizePublicLinkedInUrl,
  samePersonNameCompany,
} from "../src/lib/salesNavigator/leadIdentity";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = 50;

type LeadrocksRow = {
  id: string;
  dedupe_key: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  email_2: string | null;
  phone_2: string | null;
  linkedin_url: string | null;
  company: string | null;
  company_website: string | null;
  location: string | null;
  team_size: string | null;
  revenue_range: string | null;
  industry: string | null;
  raw: Record<string, unknown> | null;
};

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const dryRun = process.argv.includes("--dry-run");
const runName = argValue("--run-name")?.trim();
const runId = argValue("--run-id")?.trim();
const coachSlug = argValue("--coach-slug")?.trim();
const source = argValue("--source")?.trim() || "sales_navigator";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if ((!runName && !runId) || !coachSlug) {
  console.error(
    "Usage: npx tsx scripts/import-sales-nav-snapshot-to-prospects.ts --run-name \"Uk Plumbers\" --coach-slug adam-msw [--dry-run]"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function linkedinVariants(url: string): string[] {
  const normalized = normalizePublicLinkedInUrl(url);
  const out = new Set<string>();
  for (const u of [url.trim(), normalized].filter(Boolean) as string[]) {
    out.add(u);
    out.add(u.toLowerCase());
    out.add(u.replace(/\/+$/, ""));
    out.add(u.replace(/\/+$/, "").toLowerCase());
  }
  return [...out];
}

function findLeadrocksMatch(
  lead: SalesNavImportedLead,
  candidates: LeadrocksRow[]
): LeadrocksRow | null {
  const li = normalizePublicLinkedInUrl(lead.linkedinUrl);
  if (li) {
    for (const row of candidates) {
      const rowLi = normalizePublicLinkedInUrl(row.linkedin_url);
      if (rowLi && rowLi === li) return row;
      const memberUrl = row.raw?.sales_nav_member_url;
      if (
        typeof memberUrl === "string" &&
        normalizePublicLinkedInUrl(memberUrl) === li
      ) {
        return row;
      }
    }
  }
  for (const row of candidates) {
    if (samePersonNameCompany(lead, row)) return row;
  }
  return null;
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
  if (enrichment.linkedin_url) patch.linkedin_url = enrichment.linkedin_url;
  if (enrichment.company_website) patch.company_website = enrichment.company_website;
  return patch;
}

async function loadLeadrocksCandidates(): Promise<LeadrocksRow[]> {
  const byId = new Map<string, LeadrocksRow>();
  const select =
    "id, dedupe_key, full_name, first_name, last_name, job_title, email, phone, email_2, phone_2, linkedin_url, company, company_website, location, team_size, revenue_range, industry, raw";

  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("leadrocks_leads")
      .select(select)
      .eq("source", "sales_nav")
      .filter("raw->>last_sales_nav_url", "ilike", "%plumb%")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) byId.set(row.id as string, row as LeadrocksRow);
    from += 1000;
    if (data.length < 1000) break;
  }

  return [...byId.values()];
}

async function main() {
  let runQuery = supabase
    .from("sales_nav_import_runs")
    .select("id, name, lead_snapshot, scraped_count")
    .order("created_at", { ascending: false })
    .limit(1);

  if (runId) runQuery = runQuery.eq("id", runId);
  else if (runName) runQuery = runQuery.eq("name", runName);

  const { data: runRow, error: runError } = await runQuery.maybeSingle();
  if (runError || !runRow?.lead_snapshot) {
    console.error("Import run not found or has no lead_snapshot:", runError?.message);
    process.exit(1);
  }

  const snapshot = runRow.lead_snapshot as SalesNavImportedLead[];
  if (!Array.isArray(snapshot) || snapshot.length === 0) {
    console.error("lead_snapshot is empty.");
    process.exit(1);
  }

  const { data: coachRow, error: coachError } = await supabase
    .from("coaches")
    .select("id, slug")
    .eq("slug", coachSlug)
    .maybeSingle();
  if (coachError || !coachRow?.id) {
    console.error(`Coach not found for slug "${coachSlug}"`);
    process.exit(1);
  }
  const coachId = coachRow.id as string;

  const { data: existingRows } = await supabase
    .from("contacts")
    .select("linkedin_url")
    .eq("coach_id", coachId)
    .eq("type", "prospect");

  const existingLinkedIn = new Set<string>();
  for (const row of existingRows ?? []) {
    const url = (row.linkedin_url as string | null)?.trim();
    if (!url) continue;
    for (const v of linkedinVariants(url)) existingLinkedIn.add(v);
  }

  console.log(
    `Run: ${runRow.name} (${runRow.id})\nSnapshot leads: ${snapshot.length}\nCoach: ${coachSlug}\nExisting prospects w/ LinkedIn: ${existingLinkedIn.size}\nMode: ${dryRun ? "dry-run" : "import"}`
  );

  console.log("Loading leadrocks cache for enrichment…");
  const leadrocksCandidates = await loadLeadrocksCandidates();
  console.log(`Leadrocks candidates: ${leadrocksCandidates.length}`);

  let created = 0;
  let skipped = 0;
  let enrichedEmail = 0;
  let enrichedPhone = 0;
  let failed = 0;

  for (let i = 0; i < snapshot.length; i += BATCH_SIZE) {
    const batch = snapshot.slice(i, i + BATCH_SIZE);
    for (const lead of batch) {
      const linkedinRaw = lead.linkedinUrl?.trim();
      const linkedinUrl =
        canonicalLinkedInProfileUrl(linkedinRaw ?? "") ??
        normalizeLinkedInProfileUrl(linkedinRaw ?? "");
      const fullName =
        lead.fullName?.trim() ||
        [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();

      if (!fullName || !linkedinUrl) {
        skipped += 1;
        continue;
      }

      const already =
        linkedinVariants(linkedinUrl).some((v) => existingLinkedIn.has(v));
      if (already) {
        skipped += 1;
        continue;
      }

      const jobTitle = normalizeProspectLabel(lead.jobTitle ?? lead.headline ?? null);
      const businessName = normalizeProspectLabel(lead.company ?? null);
      const firstName = normalizeProspectPersonName(lead.firstName ?? null);
      const lastName = normalizeProspectPersonName(lead.lastName ?? null);

      const lrMatch = findLeadrocksMatch(lead, leadrocksCandidates);
      let enrichPatch: Record<string, unknown> = {};
      if (lrMatch) {
        const enrichment = enrichmentPatchFromLeadrocks(
          {
            linkedin_url: linkedinUrl,
            full_name: fullName,
            first_name: firstName,
            last_name: lastName,
            business_name: businessName,
          },
          lrMatch
        );
        enrichPatch = mergeEnrichment(
          {
            email: null,
            phone: null,
            job_title: jobTitle,
            business_name: businessName,
            linkedin_url: linkedinUrl,
          },
          enrichment
        );
        if (enrichPatch.email) enrichedEmail += 1;
        if (enrichPatch.phone) enrichedPhone += 1;
      }

      const insertPayload: Record<string, unknown> = {
        coach_id: coachId,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        job_title: jobTitle,
        business_name: businessName,
        linkedin_url: enrichPatch.linkedin_url ?? linkedinUrl,
        type: "prospect",
        prospect_status: "new",
        prospect_source: source,
        ...enrichPatch,
      };

      if (dryRun) {
        created += 1;
        for (const v of linkedinVariants(linkedinUrl)) existingLinkedIn.add(v);
        continue;
      }

      const { error: insertError } = await supabase.from("contacts").insert(insertPayload);
      if (insertError) {
        console.error(`Insert failed for ${fullName}:`, insertError.message);
        failed += 1;
        continue;
      }
      created += 1;
      for (const v of linkedinVariants(linkedinUrl)) existingLinkedIn.add(v);
    }

    process.stdout.write(
      `\rProcessed ${Math.min(i + BATCH_SIZE, snapshot.length)}/${snapshot.length} · created ${created}`
    );
  }

  console.log(
    `\nDone. created=${created} skipped=${skipped} failed=${failed} enriched_email=${enrichedEmail} enriched_phone=${enrichedPhone}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

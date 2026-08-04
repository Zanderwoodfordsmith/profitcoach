/**
 * Fill-blanks import from GoHighLevel "Members" contact export.
 *
 * Match order:
 *   1. Auth email (exact, case-insensitive)
 *   2. profiles.first_name + last_name (normalized; skip if ambiguous)
 *
 * Never overwrites existing non-empty profile fields. Extra GHL fields land in
 * `profiles.ghl_member_enrichment` (jsonb merge; nulls do not wipe keys).
 *
 * Prerequisites:
 *   - Migration `20260916120000_profiles_ghl_member_enrichment.sql` applied
 *   - `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/import-ghl-members-enrichment-from-csv.ts --dry-run "/path/to/Export_Contacts_….csv"
 *   npx tsx scripts/import-ghl-members-enrichment-from-csv.ts "/path/to/Export_Contacts_….csv"
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { parse } from "csv-parse/sync";
import { createClient, type User } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const csvPath = argv.filter((a) => !a.startsWith("--")).at(0);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if (!csvPath?.trim()) {
  console.error(
    "Usage: npx tsx scripts/import-ghl-members-enrichment-from-csv.ts [--dry-run] <path-to.csv>"
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

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  linkedin_url: string | null;
  industry: string | null;
  phone: string | null;
  job_title: string | null;
  ghl_member_enrichment: Record<string, unknown> | null;
};

function emptyToNull(s: string | undefined | null): string | null {
  const v = s?.trim();
  return v ? v : null;
}

function normalizeEmail(s: string | undefined | null): string | null {
  const v = emptyToNull(s);
  return v ? v.toLowerCase() : null;
}

function normalizeNamePart(s: string | undefined | null): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameKey(first: string | null | undefined, last: string | null | undefined): string {
  const f = normalizeNamePart(first);
  const l = normalizeNamePart(last);
  if (!f || !l) return "";
  return `${f}|${l}`;
}

function normalizeLinkedInUrl(raw: string | null): string | null {
  if (!raw) return null;
  let u = raw.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    if (!/linkedin\.com$/i.test(url.hostname.replace(/^www\./i, ""))) {
      // allow www.linkedin.com and country subdomains like uk.linkedin.com
      if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return u;
    }
    url.hash = "";
    // strip common tracking params
    ["trk", "originalSubdomain", "lipi"].forEach((p) => url.searchParams.delete(p));
    let out = url.toString();
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out;
  } catch {
    return u;
  }
}

async function loadAuthUsersByEmail(): Promise<Map<string, User>> {
  const byEmail = new Map<string, User>();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`);
    const users = data.users ?? [];
    for (const u of users) {
      if (u.email) byEmail.set(u.email.trim().toLowerCase(), u);
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return byEmail;
}

async function loadAllProfiles(): Promise<ProfileRow[]> {
  const out: ProfileRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, full_name, coach_business_name, linkedin_url, industry, phone, job_title, ghl_member_enrichment"
      )
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) {
      // Columns may not exist yet before migration — retry without new cols for dry-run reporting.
      if (
        /column .* does not exist/i.test(error.message) ||
        error.code === "42703"
      ) {
        const { data: fallback, error: fbErr } = await supabase
          .from("profiles")
          .select(
            "id, first_name, last_name, full_name, coach_business_name, linkedin_url, industry"
          )
          .order("id")
          .range(from, from + pageSize - 1);
        if (fbErr) throw new Error(fbErr.message);
        const rows = (fallback ?? []).map((r) => ({
          ...(r as Omit<ProfileRow, "phone" | "job_title" | "ghl_member_enrichment">),
          phone: null,
          job_title: null,
          ghl_member_enrichment: null,
        }));
        out.push(...rows);
        if (rows.length < pageSize) break;
        continue;
      }
      throw new Error(error.message);
    }
    const rows = (data ?? []) as ProfileRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

function buildEnrichment(row: CsvRow): Record<string, unknown> {
  const enrichment: Record<string, unknown> = {
    ghl_contact_id: emptyToNull(row["Contact Id"]),
    join_date: emptyToNull(row["Join Date"]),
    lead_summary: emptyToNull(row["Lead Summary"]),
    // Often former employer / lead-form company — not always coaching brand.
    business_name: emptyToNull(row["Business Name"]),
    years_in_current_job: emptyToNull(row["Years in Current Job"]),
    cumulative_exec_experience: emptyToNull(row["Cumulative Exec Experience"]),
    years_as_exec_in_developed_country: emptyToNull(
      row["Years as Exec in Developed Country"]
    ),
    company_size: emptyToNull(row["Company Size"]),
    company_summary: emptyToNull(row["Company Summary"]),
    current_company_url: emptyToNull(row["Current Company URL"]),
    linkedin_campaign_name: emptyToNull(row["LinkedIn Campaign Name"]),
    linkedin_campaign_id: emptyToNull(row["LinkedIn Campaign ID"]),
    linkedin_ad_creative_id: emptyToNull(row["LinkedIn Ad Creative ID"]),
    linkedin_ad_form_id: emptyToNull(row["LinkedIn Ad Form ID"]),
    ad_creative_name: emptyToNull(row["Ad Creative Name"]),
    imported_at: new Date().toISOString(),
    source: "ghl_members_export",
  };
  // Drop nulls so merge does not wipe existing keys with null
  for (const [k, v] of Object.entries(enrichment)) {
    if (v == null) delete enrichment[k];
  }
  return enrichment;
}

function mergeEnrichment(
  existing: Record<string, unknown> | null,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  return { ...(existing ?? {}), ...incoming };
}

type FillPlan = {
  linkedin_url?: string;
  phone?: string;
  job_title?: string;
  industry?: string;
  ghl_member_enrichment: Record<string, unknown>;
};

function planFills(profile: ProfileRow, row: CsvRow): FillPlan {
  const plan: FillPlan = {
    ghl_member_enrichment: mergeEnrichment(
      profile.ghl_member_enrichment,
      buildEnrichment(row)
    ),
  };

  const linkedin = normalizeLinkedInUrl(emptyToNull(row["Linkedin Profile URL"]));
  if (!emptyToNull(profile.linkedin_url) && linkedin) {
    plan.linkedin_url = linkedin;
  }

  const phone = emptyToNull(row["Phone"]);
  if (!emptyToNull(profile.phone) && phone) {
    plan.phone = phone;
  }

  const jobTitle = emptyToNull(row["Job Title"]);
  if (!emptyToNull(profile.job_title) && jobTitle) {
    plan.job_title = jobTitle;
  }

  const industry = emptyToNull(row["Industry"]);
  if (!emptyToNull(profile.industry) && industry) {
    plan.industry = industry;
  }

  return plan;
}

function fillCounts(plan: FillPlan): Record<string, number> {
  return {
    linkedin_url: plan.linkedin_url ? 1 : 0,
    phone: plan.phone ? 1 : 0,
    job_title: plan.job_title ? 1 : 0,
    industry: plan.industry ? 1 : 0,
    enrichment: Object.keys(plan.ghl_member_enrichment).length > 0 ? 1 : 0,
  };
}

async function main() {
  const raw = fs.readFileSync(resolvedCsv, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
    relax_column_count: true,
    relax_quotes: true,
  }) as CsvRow[];

  console.log(`[ghl-import] rows=${rows.length} dryRun=${dryRun} file=${resolvedCsv}`);

  const byEmail = await loadAuthUsersByEmail();
  const profiles = await loadAllProfiles();
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const byName = new Map<string, ProfileRow[]>();
  for (const p of profiles) {
    const key = nameKey(p.first_name, p.last_name);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(p);
    byName.set(key, list);
  }

  let matchedEmail = 0;
  let matchedName = 0;
  let unmatched = 0;
  let ambiguousName = 0;
  let wouldUpdate = 0;
  let noChange = 0;

  const totals = {
    linkedin_url: 0,
    phone: 0,
    job_title: 0,
    industry: 0,
    enrichment: 0,
  };

  const unmatchedSamples: string[] = [];
  const ambiguousSamples: string[] = [];
  const updates: { id: string; email: string | null; plan: FillPlan; match: string }[] =
    [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const email = normalizeEmail(row["Email"]);
    const first = emptyToNull(row["First Name"]);
    const last = emptyToNull(row["Last Name"]);
    const label = `${first ?? ""} ${last ?? ""} <${email ?? "?"}>`.trim();

    let profile: ProfileRow | null = null;
    let matchVia: "email" | "name" | null = null;

    if (email) {
      const user = byEmail.get(email);
      if (user) {
        profile = profileById.get(user.id) ?? null;
        if (profile) matchVia = "email";
      }
    }

    if (!profile) {
      const key = nameKey(first, last);
      if (key) {
        const candidates = byName.get(key) ?? [];
        if (candidates.length === 1) {
          profile = candidates[0]!;
          matchVia = "name";
        } else if (candidates.length > 1) {
          ambiguousName += 1;
          if (ambiguousSamples.length < 15) {
            ambiguousSamples.push(
              `${label} → ${candidates.length} profiles (${candidates
                .map((c) => c.id.slice(0, 8))
                .join(", ")})`
            );
          }
          continue;
        }
      }
    }

    if (!profile || !matchVia) {
      unmatched += 1;
      if (unmatchedSamples.length < 20) unmatchedSamples.push(label);
      continue;
    }

    if (matchVia === "email") matchedEmail += 1;
    else matchedName += 1;

    const plan = planFills(profile, row);
    const counts = fillCounts(plan);
    const hasScalarFill =
      counts.linkedin_url +
        counts.phone +
        counts.job_title +
        counts.industry >
      0;
    // Always merge enrichment when matched (new keys / refresh imported_at)
    const enrichmentChanged =
      JSON.stringify(plan.ghl_member_enrichment) !==
      JSON.stringify(profile.ghl_member_enrichment ?? {});

    if (!hasScalarFill && !enrichmentChanged) {
      noChange += 1;
      continue;
    }

    wouldUpdate += 1;
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) {
      totals[k] += counts[k];
    }

    updates.push({
      id: profile.id,
      email,
      plan,
      match: matchVia,
    });
  }

  console.log("\n=== Match summary ===");
  console.log(`matched_email:     ${matchedEmail}`);
  console.log(`matched_name:      ${matchedName}`);
  console.log(`ambiguous_name:    ${ambiguousName}`);
  console.log(`unmatched:         ${unmatched}`);
  console.log(`would_update:      ${wouldUpdate}`);
  console.log(`no_change:         ${noChange}`);

  console.log("\n=== Fill-blank field counts (among updates) ===");
  console.log(totals);

  if (ambiguousSamples.length) {
    console.log("\n=== Ambiguous name samples ===");
    for (const s of ambiguousSamples) console.log(`  ${s}`);
  }
  if (unmatchedSamples.length) {
    console.log("\n=== Unmatched samples (first 20) ===");
    for (const s of unmatchedSamples) console.log(`  ${s}`);
  }

  if (dryRun) {
    console.log("\n[ghl-import] dry-run only — no writes.");
    return;
  }

  let updated = 0;
  let failed = 0;
  for (const u of updates) {
    const patch: Record<string, unknown> = {
      ghl_member_enrichment: u.plan.ghl_member_enrichment,
    };
    if (u.plan.linkedin_url) patch.linkedin_url = u.plan.linkedin_url;
    if (u.plan.phone) patch.phone = u.plan.phone;
    if (u.plan.job_title) patch.job_title = u.plan.job_title;
    if (u.plan.industry) patch.industry = u.plan.industry;

    const { error } = await supabase.from("profiles").update(patch).eq("id", u.id);
    if (error) {
      failed += 1;
      console.error(`[ghl-import] fail ${u.email ?? u.id}: ${error.message}`);
      continue;
    }
    updated += 1;
  }

  console.log(`\n[ghl-import] updated=${updated} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

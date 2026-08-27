/**
 * Import Sales Navigator CSV exports into a coach's prospect list.
 *
 * Usage:
 *   npx tsx scripts/import-sales-nav-csv-to-prospects.ts \
 *     --coach-slug adam \
 *     --csv exports/uk-plumbing-owners.csv \
 *     --source sales_navigator
 *
 *   npx tsx scripts/import-sales-nav-csv-to-prospects.ts --dry-run ...
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

import { normalizeLinkedInProfileUrl } from "../src/lib/apify/linkedinProfile";
import {
  normalizeProspectLabel,
  normalizeProspectPersonName,
} from "../src/lib/prospectDisplayFormat";
import { splitFullName } from "../src/lib/splitFullName";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = 50;

type CsvRow = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  company?: string;
  linkedin_url?: string;
  email?: string;
  headline?: string;
};

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const dryRun = process.argv.includes("--dry-run");
const coachSlug = argValue("--coach-slug")?.trim();
const csvPath = argValue("--csv")?.trim();
const source = argValue("--source")?.trim() || "sales_navigator";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if (!coachSlug || !csvPath) {
  console.error(
    "Usage: npx tsx scripts/import-sales-nav-csv-to-prospects.ts --coach-slug <slug> --csv <path> [--source sales_navigator] [--dry-run]"
  );
  process.exit(1);
}

const absCsv = path.resolve(csvPath);
if (!fs.existsSync(absCsv)) {
  console.error(`CSV not found: ${absCsv}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function resolveJobTitle(row: CsvRow): string | null {
  const title = normalizeProspectLabel(row.job_title ?? null);
  if (title) return title;
  const headline = row.headline?.trim();
  if (!headline) return null;
  return normalizeProspectLabel(headline.slice(0, 200));
}

function resolveFullName(row: CsvRow): string | null {
  const explicit = row.full_name?.trim();
  if (explicit) {
    const parts = splitFullName(explicit);
    const normalized = [
      normalizeProspectPersonName(parts.first_name),
      normalizeProspectPersonName(parts.last_name),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    return normalized || explicit;
  }
  const first = normalizeProspectPersonName(row.first_name ?? null);
  const last = normalizeProspectPersonName(row.last_name ?? null);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}

async function main() {
  const { enrichProspectFromLeadrocks } = await import(
    "../src/lib/prospects/matchLeadrocksLead"
  );

  const { data: coachRow, error: coachError } = await supabase
    .from("coaches")
    .select("id, slug")
    .eq("slug", coachSlug)
    .maybeSingle();

  if (coachError || !coachRow?.id) {
    console.error(`Coach not found for slug "${coachSlug}":`, coachError?.message);
    process.exit(1);
  }

  const coachId = coachRow.id as string;
  const raw = fs.readFileSync(absCsv, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as CsvRow[];

  console.log(
    `Coach: ${coachSlug} (${coachId})\nCSV: ${absCsv}\nRows: ${rows.length}\nSource: ${source}\nMode: ${dryRun ? "dry-run" : "import"}`
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      const linkedinUrl = normalizeLinkedInProfileUrl(row.linkedin_url ?? "");
      const fullName = resolveFullName(row);
      if (!fullName) {
        skipped += 1;
        continue;
      }
      if (!linkedinUrl) {
        skipped += 1;
        continue;
      }

      const email = row.email?.trim().toLowerCase() || null;
      const jobTitle = resolveJobTitle(row);
      const businessName = normalizeProspectLabel(row.company ?? null);
      const parts = splitFullName(fullName);

      const patch: Record<string, unknown> = {
        full_name: fullName,
        first_name: normalizeProspectPersonName(parts.first_name),
        last_name: normalizeProspectPersonName(parts.last_name),
        job_title: jobTitle,
        business_name: businessName,
        linkedin_url: linkedinUrl,
        type: "prospect",
        prospect_source: source,
      };
      if (email) patch.email = email;

      const enrichment = await enrichProspectFromLeadrocks({
        linkedin_url: linkedinUrl,
        full_name: fullName,
        first_name: parts.first_name,
        last_name: parts.last_name,
        business_name: businessName,
      });
      if (enrichment) {
        if (!patch.email && enrichment.email) patch.email = enrichment.email;
        if (!patch.phone && enrichment.phone) patch.phone = enrichment.phone;
        if (!patch.job_title && enrichment.job_title) {
          patch.job_title = enrichment.job_title;
        }
        if (!patch.business_name && enrichment.business_name) {
          patch.business_name = enrichment.business_name;
        }
        if (enrichment.linkedin_url) patch.linkedin_url = enrichment.linkedin_url;
      }

      if (dryRun) {
        created += 1;
        continue;
      }

      const { data: existing, error: lookupError } = await supabase
        .from("contacts")
        .select("id")
        .eq("coach_id", coachId)
        .eq("linkedin_url", linkedinUrl)
        .maybeSingle();

      if (lookupError) {
        console.error("Lookup failed:", lookupError.message);
        failed += 1;
        continue;
      }

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("contacts")
          .update(patch)
          .eq("id", existing.id);
        if (updateError) {
          console.error(`Update failed for ${fullName}:`, updateError.message);
          failed += 1;
        } else {
          updated += 1;
        }
        continue;
      }

      const insertPayload = {
        coach_id: coachId,
        prospect_status: "new",
        ...patch,
      };

      const { error: insertError } = await supabase
        .from("contacts")
        .insert(insertPayload);

      if (insertError) {
        console.error(`Insert failed for ${fullName}:`, insertError.message);
        failed += 1;
      } else {
        created += 1;
      }
    }

    process.stdout.write(
      `\rProcessed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`
    );
  }

  console.log(
    `\nDone. created=${created} updated=${updated} skipped=${skipped} failed=${failed}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

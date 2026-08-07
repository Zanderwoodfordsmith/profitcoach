/**
 * Import LeadRocks CSV exports into `leadrocks_leads` (local-first search corpus).
 *
 * Keeps a lean contact shape: email + email_2, phone + phone_2.
 * Skips Facebook, funding, email status columns, and phones/emails #3+.
 *
 * Prerequisites:
 *   - Migration `20260921120000_leadrocks_leads_email2_phone2.sql` applied
 *   - `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/import-leadrocks-csv-to-leads.ts --dry-run ~/Downloads
 *   npx tsx scripts/import-leadrocks-csv-to-leads.ts ~/Downloads
 *   npx tsx scripts/import-leadrocks-csv-to-leads.ts path/to/one.csv path/to/two.csv
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SOURCE = "leadrocks_csv";
const BATCH_SIZE = 250;

type RegionMeta = { category: string; categorySlug: string };

function regionFromFilename(filename: string): RegionMeta {
  const base = path.basename(filename).toLowerCase();
  if (base.startsWith("leadrocks_usa_") || base.includes("_usa_")) {
    return { category: "US Business Owners", categorySlug: "us_business_owners" };
  }
  return { category: "UK Business Owners", categorySlug: "uk_business_owners" };
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const paths = argv.filter((a) => !a.startsWith("--"));

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if (paths.length === 0) {
  console.error(
    "Usage: npx tsx scripts/import-leadrocks-csv-to-leads.ts [--dry-run] <csv-or-dir>..."
  );
  process.exit(1);
}

/** Directory scan: UK/USA owner + revenue/construction exports (not Campaign Prospects). */
const OWNER_CSV_RE =
  /^leadrocks_(?:uk|usa)_.+\.csv$/i;

function resolveCsvFiles(inputs: string[]): string[] {
  const out: string[] = [];
  for (const input of inputs) {
    const resolved = path.resolve(input);
    if (!fs.existsSync(resolved)) {
      console.error(`Path not found: ${resolved}`);
      process.exit(1);
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const files = fs
        .readdirSync(resolved)
        .filter((name) => OWNER_CSV_RE.test(name))
        .map((name) => path.join(resolved, name))
        .sort();
      if (files.length === 0) {
        console.error(
          `No matching leadrocks_uk_*_mds_founder_ceo_owner*.csv in ${resolved}`
        );
        process.exit(1);
      }
      out.push(...files);
    } else {
      out.push(resolved);
    }
  }
  return [...new Set(out)];
}

function emptyToNull(s: string | undefined | null): string | null {
  const v = s?.trim();
  return v ? v : null;
}

function pickDistinct(
  primary: string | null,
  candidates: Array<string | null>
): { first: string | null; second: string | null } {
  const first = primary;
  const second =
    candidates
      .map((c) => emptyToNull(c))
      .find((c) => c && c.toLowerCase() !== first?.toLowerCase()) ?? null;
  return { first, second };
}

type TeamSizeBand = "1-10" | "11-50" | "51-200" | "201-500";

/** Map LeadRocks headcount / export band → UI team-size buckets. */
function normalizeTeamSize(
  raw: string | null,
  fileBand: TeamSizeBand | null
): string | null {
  if (fileBand) return fileBand;
  if (!raw) return null;
  const n = Number.parseInt(raw.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(n)) return raw;
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  if (n <= 500) return "201-500";
  if (n <= 1000) return "501-1000";
  if (n <= 5000) return "1001-5000";
  if (n <= 10000) return "5001-10000";
  return "10001+";
}

/** Align CSV revenue labels closer to our filter presets where possible. */
function normalizeRevenue(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  const map: Record<string, string> = {
    "Less than $1M": "$0 - $1M",
    "$1M to $10M": "$1M - $10M",
    "$10M to $50M": "$10M - $50M",
    "$50M to $100M": "$50M - $100M",
    "$100M to $500M": "$100M+",
    "$500M to $1B": "$100M+",
    "$1B to $10B": "$100M+",
    "$10B+": "$100M+",
  };
  return map[t] ?? t;
}

function bandFromFilename(filename: string): TeamSizeBand | null {
  const base = path.basename(filename).toLowerCase();
  if (base.includes("_11_50_")) return "11-50";
  if (base.includes("_51_200_")) return "51-200";
  if (base.includes("_201_500_")) return "201-500";
  return null;
}

/** Parse `…_2026_08_03.csv` → `2026-08-03`. */
function exportDateFromFilename(filename: string): string | null {
  const m = path.basename(filename).match(/_(\d{4})_(\d{2})_(\d{2})\.csv$/i);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function buildDedupeKey(input: {
  email?: string | null;
  linkedinUrl?: string | null;
  fullName?: string | null;
  company?: string | null;
}): string {
  const email = input.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  const li = input.linkedinUrl?.trim().toLowerCase().replace(/\/+$/, "");
  if (li) return `linkedin:${li}`;
  const name = (input.fullName ?? "").trim().toLowerCase();
  const company = (input.company ?? "").trim().toLowerCase();
  const hash = createHash("sha256")
    .update(`${name}|${company}`)
    .digest("hex")
    .slice(0, 24);
  return `nameco:${hash}`;
}

type LeadRow = {
  dedupe_key: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  company: string | null;
  company_website: string | null;
  location: string | null;
  state: string | null;
  industry: string | null;
  category: string;
  category_slug: string;
  team_size: string | null;
  revenue_range: string | null;
  raw: Record<string, string>;
  source: string;
  /** ISO date (YYYY-MM-DD) from CSV filename — LeadRocks export freshness. */
  exported_at: string | null;
  last_seen_at: string;
};

function rowFromCsv(
  row: Record<string, string>,
  fileBand: TeamSizeBand | null,
  exportedAt: string | null,
  now: string,
  region: RegionMeta
): LeadRow | null {
  const linkedinUrl = emptyToNull(row["Linked Url"]);
  const fullName = emptyToNull(row["Full Name"]);
  const company = emptyToNull(row["Company"]);
  const work1 = emptyToNull(row["Work Email #1"]);
  const work2 = emptyToNull(row["Work Email #2"]);
  const direct1 = emptyToNull(row["Direct Email #1"]);
  const companyEmail = emptyToNull(row["Company Email"]);
  const phone1 = emptyToNull(row["Phone #1"]);
  const phone2 = emptyToNull(row["Phone #2"]);
  const companyPhone = emptyToNull(row["Company Phone"]);

  const emails = pickDistinct(work1 ?? work2 ?? direct1 ?? companyEmail, [
    work1,
    work2,
    direct1,
    companyEmail,
  ]);
  const phones = pickDistinct(phone1 ?? companyPhone ?? phone2, [
    phone1,
    companyPhone,
    phone2,
  ]);

  if (!fullName && !emails.first && !linkedinUrl && !company) return null;

  // Lean raw: second contacts + export date + useful leftovers.
  const raw: Record<string, string> = {};
  if (emails.second) raw.email_2 = emails.second;
  if (phones.second) raw.phone_2 = phones.second;
  if (exportedAt) raw.exported_at = exportedAt;
  for (const key of [
    "Work Email #1 Status",
    "Direct Email #1",
    "Company Email",
    "Company Phone",
    "Total Funding",
  ]) {
    const v = emptyToNull(row[key]);
    if (v) raw[key] = v;
  }

  return {
    dedupe_key: buildDedupeKey({
      email: emails.first,
      linkedinUrl,
      fullName,
      company,
    }),
    full_name: fullName,
    first_name: emptyToNull(row["First Name"]),
    last_name: emptyToNull(row["Last Name"]),
    job_title: emptyToNull(row["Job Title"]),
    email: emails.first,
    phone: phones.first,
    linkedin_url: linkedinUrl,
    company,
    company_website: emptyToNull(row["Company Website"]),
    location: emptyToNull(row["Location"]),
    state: null,
    industry: emptyToNull(row["Industry"]),
    category: region.category,
    category_slug: region.categorySlug,
    team_size: normalizeTeamSize(emptyToNull(row["Team Size"]), fileBand),
    revenue_range: normalizeRevenue(emptyToNull(row["Revenue Range"])),
    raw,
    source: SOURCE,
    exported_at: exportedAt,
    last_seen_at: now,
  };
}

const csvFiles = resolveCsvFiles(paths);

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(
    `${dryRun ? "[dry-run] " : ""}Importing ${csvFiles.length} CSV file(s)…`
  );

  const byKey = new Map<string, LeadRow>();
  let parsedRows = 0;
  let skipped = 0;

  for (const file of csvFiles) {
    const band = bandFromFilename(file);
    const exportedAt = exportDateFromFilename(file);
    const region = regionFromFilename(file);
    const text = fs.readFileSync(file, "utf8");
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    }) as Record<string, string>[];

    const now = new Date().toISOString();
    let fileKept = 0;
    for (const record of records) {
      parsedRows += 1;
      const lead = rowFromCsv(record, band, exportedAt, now, region);
      if (!lead) {
        skipped += 1;
        continue;
      }
      // Later files win on duplicate keys within this import batch.
      byKey.set(lead.dedupe_key, lead);
      fileKept += 1;
    }
    console.log(
      `  ${path.basename(file)}: ${records.length} rows → ${fileKept} kept (${region.categorySlug}, band ${band ?? "from value"}, exported ${exportedAt ?? "unknown"})`
    );
  }

  const leads = [...byKey.values()];
  console.log(
    `\nParsed ${parsedRows} rows → ${leads.length} unique leads (${skipped} skipped).`
  );

  if (dryRun) {
    const withEmail = leads.filter((l) => l.email).length;
    const withEmail2 = leads.filter((l) => l.raw.email_2).length;
    const withPhone = leads.filter((l) => l.phone).length;
    const withPhone2 = leads.filter((l) => l.raw.phone_2).length;
    const exportDates = [
      ...new Set(leads.map((l) => l.exported_at).filter(Boolean)),
    ];
    console.log(
      `Contact coverage: email ${withEmail}, email_2 ${withEmail2}, phone ${withPhone}, phone_2 ${withPhone2}`
    );
    console.log(`Export dates: ${exportDates.join(", ") || "none"}`);
    console.log("Sample:", leads.slice(0, 2));
    return;
  }

  let includeExportedAt = true;
  let upserted = 0;
  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const chunk = leads.slice(i, i + BATCH_SIZE).map((lead) => {
      if (includeExportedAt) return lead;
      const { exported_at: _drop, ...rest } = lead;
      return rest;
    });
    const { error } = await supabase.from("leadrocks_leads").upsert(chunk, {
      onConflict: "dedupe_key",
      ignoreDuplicates: false,
    });
    if (
      error?.message?.includes("exported_at") &&
      includeExportedAt
    ) {
      includeExportedAt = false;
      console.log(
        "\nexported_at column not applied yet — storing date in raw only."
      );
      i -= BATCH_SIZE;
      continue;
    }
    if (error) {
      console.error(`Upsert failed at offset ${i}: ${error.message}`);
      process.exit(1);
    }
    upserted += chunk.length;
    process.stdout.write(`\rUpserted ${upserted}/${leads.length}`);
  }

  const exportDates = [
    ...new Set(leads.map((l) => l.exported_at).filter(Boolean)),
  ];
  console.log(
    `\nDone. ${upserted} leads in leadrocks_leads (source=${SOURCE}, exported ${exportDates.join(", ") || "unknown"}).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

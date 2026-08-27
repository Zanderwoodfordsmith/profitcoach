/**
 * Restore LeadRocks vanity LinkedIn URLs that a Sales Nav import overwrote
 * with an opaque /in/ACwAAA… member-id URL.
 *
 * Sources, in order:
 *   1. A vanity URL still sitting on `dedupe_key` (`linkedin:<vanity>`)
 *   2. The original LeadRocks CSV export(s), rematched by email then name+company
 *
 * The member-id URL is kept in `raw.sales_nav_member_url` so it is not lost.
 *
 * Usage:
 *   npx tsx scripts/restore-leadrocks-vanity-urls.ts --dry-run ~/Downloads
 *   npx tsx scripts/restore-leadrocks-vanity-urls.ts ~/Downloads
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

import {
  isObfuscatedLinkedInUrl,
  isVanityLinkedInUrl,
  normalizePublicLinkedInUrl,
  vanityUrlFromDedupeKey,
} from "../src/lib/salesNavigator/leadIdentity";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dryRun = process.argv.includes("--dry-run");
const csvInputs = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const CSV_RE = /^leadrocks_.*\.csv$/i;

type CacheRow = {
  id: string;
  source: string;
  dedupe_key: string;
  linkedin_url: string | null;
  full_name: string | null;
  company: string | null;
  email: string | null;
  raw: Record<string, unknown> | null;
};

type CsvHit = {
  vanityUrl: string;
  file: string;
};

function emptyToNull(s: string | undefined | null): string | null {
  const v = s?.trim();
  return v ? v : null;
}

function normEmail(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase();
  return v || null;
}

function nameCompanyKey(
  name: string | null | undefined,
  company: string | null | undefined
): string | null {
  const n = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const c = (company ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!n || !c) return null;
  return `${n}|${c}`;
}

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
        .filter((name) => CSV_RE.test(name))
        .map((name) => path.join(resolved, name))
        .sort();
      out.push(...files);
    } else {
      out.push(resolved);
    }
  }
  return [...new Set(out)];
}

function loadCsvIndexes(files: string[]): {
  byEmail: Map<string, CsvHit>;
  byNameCompany: Map<string, CsvHit>;
  rows: number;
} {
  const byEmail = new Map<string, CsvHit>();
  const byNameCompany = new Map<string, CsvHit>();
  let rows = 0;

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    for (const rec of records) {
      rows += 1;
      const vanity = normalizePublicLinkedInUrl(rec["Linked Url"]);
      if (!vanity || !isVanityLinkedInUrl(vanity)) continue;
      const hit: CsvHit = { vanityUrl: vanity, file: path.basename(file) };

      const emails = [
        rec["Work Email #1"],
        rec["Work Email #2"],
        rec["Direct Email #1"],
        rec["Company Email"],
      ]
        .map(normEmail)
        .filter((e): e is string => Boolean(e));
      for (const email of emails) {
        if (!byEmail.has(email)) byEmail.set(email, hit);
      }

      const nc = nameCompanyKey(rec["Full Name"], rec["Company"]);
      if (nc && !byNameCompany.has(nc)) byNameCompany.set(nc, hit);
    }
  }

  return { byEmail, byNameCompany, rows };
}

async function fetchOverwrittenRows(): Promise<CacheRow[]> {
  const page = 500;
  const out: CacheRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("leadrocks_leads")
      .select(
        "id, source, dedupe_key, linkedin_url, full_name, company, email, raw"
      )
      .like("source", "leadrocks%")
      .ilike("linkedin_url", "%/in/ac%aa%")
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as CacheRow[];
    out.push(...batch);
    if (batch.length < page) break;
    from += page;
  }
  return out.filter((row) => isObfuscatedLinkedInUrl(row.linkedin_url));
}

function resolveVanity(
  row: CacheRow,
  byEmail: Map<string, CsvHit>,
  byNameCompany: Map<string, CsvHit>
): { vanity: string; via: "dedupe_key" | "csv_email" | "csv_name_company" } | null {
  const fromKey = vanityUrlFromDedupeKey(row.dedupe_key);
  if (fromKey) return { vanity: fromKey, via: "dedupe_key" };

  const email = normEmail(row.email);
  if (email) {
    const hit = byEmail.get(email);
    if (hit) return { vanity: hit.vanityUrl, via: "csv_email" };
  }

  const nc = nameCompanyKey(row.full_name, row.company);
  if (nc) {
    const hit = byNameCompany.get(nc);
    if (hit) return { vanity: hit.vanityUrl, via: "csv_name_company" };
  }

  return null;
}

async function main() {
  if (csvInputs.length === 0) {
    console.error(
      "Usage: npx tsx scripts/restore-leadrocks-vanity-urls.ts [--dry-run] <csv-or-dir>..."
    );
    process.exit(1);
  }

  const files = resolveCsvFiles(csvInputs);
  console.log(
    `[restore-vanity] ${dryRun ? "dry-run · " : ""}csv files=${files.length}`
  );

  const indexes = loadCsvIndexes(files);
  console.log(
    `[restore-vanity] csv rows=${indexes.rows}` +
      ` emails=${indexes.byEmail.size}` +
      ` name+company=${indexes.byNameCompany.size}`
  );

  const rows = await fetchOverwrittenRows();
  console.log(`[restore-vanity] overwritten LeadRocks rows=${rows.length}`);

  const tally = {
    restored: 0,
    skippedNoVanity: 0,
    alreadyVanity: 0,
    via: { dedupe_key: 0, csv_email: 0, csv_name_company: 0 },
  };
  const samples: string[] = [];

  for (const row of rows) {
    if (isVanityLinkedInUrl(row.linkedin_url)) {
      tally.alreadyVanity += 1;
      continue;
    }

    const resolved = resolveVanity(row, indexes.byEmail, indexes.byNameCompany);
    if (!resolved) {
      tally.skippedNoVanity += 1;
      continue;
    }

    tally.restored += 1;
    tally.via[resolved.via] += 1;
    if (samples.length < 8) {
      samples.push(
        `${row.full_name ?? "?"}  ${row.linkedin_url}  →  ${resolved.vanity}  (${resolved.via})`
      );
    }

    if (dryRun) continue;

    const nextRaw = {
      ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
      sales_nav_member_url:
        normalizePublicLinkedInUrl(row.linkedin_url) ?? row.linkedin_url,
      vanity_restored_at: new Date().toISOString(),
      vanity_restored_via: resolved.via,
    };

    const { error } = await supabase
      .from("leadrocks_leads")
      .update({
        linkedin_url: resolved.vanity,
        raw: nextRaw,
      })
      .eq("id", row.id);
    if (error) {
      console.error(`  update failed ${row.id}: ${error.message}`);
    }
  }

  if (samples.length) {
    console.log("[restore-vanity] samples:");
    for (const line of samples) console.log(`  ${line}`);
  }

  console.log(
    `[restore-vanity] done. restored=${tally.restored}` +
      ` (dedupe_key=${tally.via.dedupe_key}` +
      ` csv_email=${tally.via.csv_email}` +
      ` csv_name_company=${tally.via.csv_name_company})` +
      ` skipped_no_vanity=${tally.skippedNoVanity}` +
      ` already_vanity=${tally.alreadyVanity}` +
      (dryRun ? " (dry-run — nothing written)" : "")
  );
}

main().catch((err) => {
  console.error("[restore-vanity] fatal:", err);
  process.exit(1);
});

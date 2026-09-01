/**
 * Restore case-sensitive Sales Nav member-id LinkedIn URLs that were
 * stored lowercased (those 404). Source of truth: sales_nav_import_runs
 * lead_snapshot, which keeps the scrape URL (e.g. /in/ACwAAAoDnr4…).
 *
 * Usage:
 *   npx tsx scripts/restore-sales-nav-profile-url-case.ts --dry-run
 *   npx tsx scripts/restore-sales-nav-profile-url-case.ts
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  canonicalLinkedInProfileUrl,
  isObfuscatedLinkedInUrl,
  isVanityLinkedInUrl,
  normalizePublicLinkedInUrl,
} from "../src/lib/salesNavigator/leadIdentity";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function preferCased(existing: string, incoming: string): string {
  const existingMixed = existing !== existing.toLowerCase();
  const incomingMixed = incoming !== incoming.toLowerCase();
  if (incomingMixed && !existingMixed) return incoming;
  return existing;
}

async function loadCasedUrlByKey(): Promise<Map<string, string>> {
  const byKey = new Map<string, string>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("sales_nav_import_runs")
      .select("id, name, lead_snapshot")
      .range(from, from + 19);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const run of data) {
      const snap = run.lead_snapshot;
      if (!Array.isArray(snap)) continue;
      for (const lead of snap) {
        const raw =
          typeof lead?.linkedinUrl === "string" ? lead.linkedinUrl : null;
        const cased = canonicalLinkedInProfileUrl(raw);
        const key = normalizePublicLinkedInUrl(raw);
        if (!cased || !key || !isObfuscatedLinkedInUrl(cased)) continue;
        if (cased === cased.toLowerCase()) continue;
        const prev = byKey.get(key);
        byKey.set(key, prev ? preferCased(prev, cased) : cased);
      }
    }

    from += 20;
    if (data.length < 20) break;
  }
  return byKey;
}

const WRITE_CONCURRENCY = 25;

async function restoreTable(opts: {
  table: "contacts" | "leadrocks_leads";
  byKey: Map<string, string>;
}): Promise<{ scanned: number; updated: number; skippedVanity: number }> {
  let scanned = 0;
  let updated = 0;
  let skippedVanity = 0;
  let from = 0;
  const rows: { id: string; linkedin_url: string | null }[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(opts.table)
      .select("id, linkedin_url")
      .not("linkedin_url", "is", null)
      .ilike("linkedin_url", "%/in/ac%")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`${opts.table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(
      ...(data as { id: string; linkedin_url: string | null }[])
    );
    from += 1000;
    if (data.length < 1000) break;
  }

  const pending: { id: string; linkedin_url: string }[] = [];
  for (const row of rows) {
      scanned += 1;
      const current = (row.linkedin_url as string | null)?.trim() || "";
      if (!current || isVanityLinkedInUrl(current)) {
        skippedVanity += 1;
        continue;
      }
      const key = normalizePublicLinkedInUrl(current);
      const cased = key ? opts.byKey.get(key) : null;
      if (!cased || cased === current) continue;
      pending.push({ id: row.id as string, linkedin_url: cased });
    }

    if (!dryRun) {
      for (let i = 0; i < pending.length; i += WRITE_CONCURRENCY) {
        const chunk = pending.slice(i, i + WRITE_CONCURRENCY);
        const results = await Promise.all(
          chunk.map((row) =>
            supabase
              .from(opts.table)
              .update({ linkedin_url: row.linkedin_url })
              .eq("id", row.id)
          )
        );
        for (const result of results) {
          if (result.error) {
            console.error(`${opts.table} update failed:`, result.error.message);
          }
        }
      }
    }
  updated += pending.length;

  return { scanned, updated, skippedVanity };
}

async function main() {
  console.log(dryRun ? "Dry run." : "Writing restored URLs.");
  const byKey = await loadCasedUrlByKey();
  console.log(`Snapshot member-id URLs with original case: ${byKey.size}`);

  const contacts = await restoreTable({ table: "contacts", byKey });
  const leads = await restoreTable({ table: "leadrocks_leads", byKey });

  console.log("contacts", contacts);
  console.log("leadrocks_leads", leads);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

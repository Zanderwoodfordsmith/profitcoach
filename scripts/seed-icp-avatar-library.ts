/**
 * Seed `icp_avatar_library` from the curated static data in
 * `src/lib/firstCampaign/librarySeedData.ts`.
 *
 * Optionally attaches a short raw-text excerpt from matching files in
 * `.ica-research/docs/` (gitignored corpus) as `exemplar_payload.sourceExcerpts`
 * when that folder is present — never fails if it's missing.
 *
 * Usage:
 *   npx tsx scripts/seed-icp-avatar-library.ts
 *   npx tsx scripts/seed-icp-avatar-library.ts --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

import { LIBRARY_SEED_ENTRIES, type LibrarySeedEntry } from "../src/lib/firstCampaign/librarySeedData";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RESEARCH_DOCS_DIR = path.join(process.cwd(), ".ica-research", "docs");
const EXCERPT_MAX_CHARS = 2_000;
const MAX_EXEMPLARS_PER_INDUSTRY = 3;

function findExemplarExcerpts(entry: LibrarySeedEntry): { file: string; excerpt: string }[] {
  if (!fs.existsSync(RESEARCH_DOCS_DIR)) return [];
  const out: { file: string; excerpt: string }[] = [];
  for (const fileName of entry.sourceFiles) {
    if (out.length >= MAX_EXEMPLARS_PER_INDUSTRY) break;
    const filePath = path.join(RESEARCH_DOCS_DIR, fileName);
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      out.push({ file: fileName, excerpt: raw.slice(0, EXCERPT_MAX_CHARS) });
    } catch {
      // best-effort only
    }
  }
  return out;
}

function buildExemplarPayload(entry: LibrarySeedEntry): Record<string, unknown> {
  const excerpts = findExemplarExcerpts(entry);
  if (excerpts.length === 0) return {};
  return {
    sourceExcerpts: excerpts,
    note: `Truncated to ${EXCERPT_MAX_CHARS} chars per file; from .ica-research/docs (gitignored, local-only corpus).`,
  };
}

async function main() {
  const researchDocsPresent = fs.existsSync(RESEARCH_DOCS_DIR);
  console.log(
    `[seed-icp-avatar-library]${dryRun ? " dry-run" : ""} entries=${LIBRARY_SEED_ENTRIES.length} ` +
      `research_docs=${researchDocsPresent ? "found" : "not found (skipping exemplars)"}`
  );

  let ok = 0;
  let failed = 0;

  for (const entry of LIBRARY_SEED_ENTRIES) {
    const exemplarPayload = buildExemplarPayload(entry);
    const row = {
      industry_key: entry.industryKey,
      industry_label: entry.industryLabel,
      depth: entry.depth,
      confidence: entry.confidence,
      role_titles: entry.roleTitles,
      team_size: entry.teamSize,
      revenue_range: entry.revenueRange,
      geography: entry.geography,
      vocabulary: entry.vocabulary,
      universal_pains: entry.universalPains,
      industry_pains: entry.industryPains,
      main_desires: entry.mainDesires,
      objections: entry.objections,
      buying_triggers: entry.buyingTriggers,
      exemplar_payload: exemplarPayload,
      source_files: entry.sourceFiles,
      updated_at: new Date().toISOString(),
    };

    if (dryRun) {
      console.log(
        `  - ${entry.industryKey} (${entry.depth}) — exemplars=${
          Object.keys(exemplarPayload).length > 0
            ? (exemplarPayload.sourceExcerpts as unknown[]).length
            : 0
        }`
      );
      continue;
    }

    const { error } = await supabase
      .from("icp_avatar_library")
      .upsert(row, { onConflict: "industry_key" });

    if (error) {
      failed += 1;
      console.log(`  FAIL ${entry.industryKey}: ${error.message}`);
    } else {
      ok += 1;
      console.log(`  OK ${entry.industryKey}`);
    }
  }

  console.log(
    `[seed-icp-avatar-library] done. ok=${ok} failed=${failed} total=${LIBRARY_SEED_ENTRIES.length}`
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[seed-icp-avatar-library] fatal:", err);
  process.exit(1);
});

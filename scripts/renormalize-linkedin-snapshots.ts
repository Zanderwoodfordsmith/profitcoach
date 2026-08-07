/**
 * Re-normalize coach_linkedin_profiles.snapshot from stored `raw`
 * (no Apify calls). Picks up newer fields like employmentType / experienceGroupId.
 *
 * Run: npx tsx scripts/renormalize-linkedin-snapshots.ts
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

import { normalizeLinkedInProfileItem } from "../src/lib/apify/linkedinProfile";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await supabase
    .from("coach_linkedin_profiles")
    .select("coach_id, linkedin_url, raw");

  if (error) {
    console.error(error);
    process.exit(1);
  }

  let ok = 0;
  let failed = 0;

  for (const row of data ?? []) {
    const raw = row.raw as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") {
      failed += 1;
      console.log(`skip ${row.coach_id}: no raw`);
      continue;
    }

    try {
      const snapshot = normalizeLinkedInProfileItem(
        raw,
        (row.linkedin_url as string) ?? null
      );
      if (dryRun) {
        console.log(
          `dry-run ${row.coach_id}: experiences=${snapshot.experiences.length} groups=` +
            new Set(
              snapshot.experiences
                .map((e) => e.experienceGroupId)
                .filter(Boolean)
            ).size
        );
        ok += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("coach_linkedin_profiles")
        .update({ snapshot, updated_at: new Date().toISOString() })
        .eq("coach_id", row.coach_id);

      if (updateError) {
        failed += 1;
        console.log(`FAIL ${row.coach_id}: ${updateError.message}`);
      } else {
        ok += 1;
        console.log(
          `ok ${row.coach_id} experiences=${snapshot.experiences.length}`
        );
      }
    } catch (err) {
      failed += 1;
      console.log(
        `FAIL ${row.coach_id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(`[renormalize] done ok=${ok} failed=${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

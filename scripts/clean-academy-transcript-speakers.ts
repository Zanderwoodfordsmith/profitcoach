/**
 * Strip "Speaker 1", "Speaker 2", etc. from existing academy_lesson_content.transcript_text.
 *
 * Safe to run while video import is running (only updates transcript column).
 *
 * Usage:
 *   npx tsx scripts/clean-academy-transcript-speakers.ts --dry-run
 *   npx tsx scripts/clean-academy-transcript-speakers.ts
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { stripTranscriptSpeakerLabels } from "../src/lib/academy/stripTranscriptSpeakerLabels";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SPEAKER_PATTERN = /Speaker\s*\d+/i;

async function main() {
  const { data: rows, error } = await supabase
    .from("academy_lesson_content")
    .select("course_id, lesson_id, transcript_text")
    .not("transcript_text", "is", null);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const text = (row.transcript_text as string)?.trim();
    if (!text || !SPEAKER_PATTERN.test(text)) {
      skipped += 1;
      continue;
    }

    const cleaned = stripTranscriptSpeakerLabels(text);
    if (cleaned === text) {
      skipped += 1;
      continue;
    }

    console.log(`[clean] ${row.course_id}/${row.lesson_id}`);
    if (!dryRun) {
      const { error: upErr } = await supabase
        .from("academy_lesson_content")
        .update({ transcript_text: cleaned, updated_at: new Date().toISOString() })
        .eq("course_id", row.course_id)
        .eq("lesson_id", row.lesson_id);
      if (upErr) {
        console.error(`  failed: ${upErr.message}`);
        continue;
      }
    }
    updated += 1;
  }

  console.log(
    `[clean] done dryRun=${dryRun} updated=${updated} skipped=${skipped} total=${rows?.length ?? 0}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

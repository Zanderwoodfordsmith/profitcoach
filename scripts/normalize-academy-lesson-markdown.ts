/**
 * Tidy up stored academy lesson markdown (Classroom + Programs share one table).
 *
 * Runs normalizeLessonMarkdown over every academy_lesson_content.body_markdown,
 * repairing jammed `****` bold, dangling delimiters, and missing blank lines
 * between blocks. Embeds (`html-embed` fences) and accordions are preserved.
 *
 * Usage:
 *   npx tsx scripts/normalize-academy-lesson-markdown.ts --dry-run   (default; no writes)
 *   npx tsx scripts/normalize-academy-lesson-markdown.ts --apply     (backup + write)
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { normalizeLessonMarkdown } from "../src/lib/academy/normalizeLessonMarkdown";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes("--apply");
const dryRun = !apply;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = {
  course_id: string;
  lesson_id: string;
  body_markdown: string | null;
};

/** Show the first chunk that differs between before/after, with a little context. */
function diffSnippet(before: string, after: string, radius = 120): string {
  let start = 0;
  const min = Math.min(before.length, after.length);
  while (start < min && before[start] === after[start]) start += 1;

  const from = Math.max(0, start - radius);
  const beforeChunk = before.slice(from, start + radius).replace(/\n/g, "\\n");
  const afterChunk = after.slice(from, start + radius).replace(/\n/g, "\\n");
  return `    before: …${beforeChunk}…\n    after:  …${afterChunk}…`;
}

async function main() {
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("course_id, lesson_id, body_markdown")
    .not("body_markdown", "is", null);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  const changes: { row: Row; normalized: string }[] = [];
  let unchanged = 0;

  for (const row of rows) {
    const original = row.body_markdown ?? "";
    if (!original.trim()) {
      unchanged += 1;
      continue;
    }

    const normalized = normalizeLessonMarkdown(original);
    if (normalized === original) {
      unchanged += 1;
      continue;
    }

    changes.push({ row, normalized });
    console.log(`[normalize] ${row.course_id}/${row.lesson_id}`);
    console.log(diffSnippet(original, normalized));
  }

  if (apply && changes.length > 0) {
    const dir = join(process.cwd(), "scripts", "backups");
    mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join(dir, `academy-lesson-markdown-${ts}.json`);
    writeFileSync(file, JSON.stringify(changes.map((c) => c.row), null, 2), "utf8");
    console.log(`[normalize] backed up ${changes.length} original rows to ${file}`);
  }

  let failed = 0;
  if (apply) {
    for (const { row, normalized } of changes) {
      const { error: upErr } = await supabase
        .from("academy_lesson_content")
        .update({ body_markdown: normalized, updated_at: new Date().toISOString() })
        .eq("course_id", row.course_id)
        .eq("lesson_id", row.lesson_id);
      if (upErr) {
        console.error(`  failed ${row.course_id}/${row.lesson_id}: ${upErr.message}`);
        failed += 1;
      }
    }
  }

  console.log(
    `[normalize] done apply=${apply} dryRun=${dryRun} changed=${changes.length} unchanged=${unchanged} failed=${failed} total=${rows.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

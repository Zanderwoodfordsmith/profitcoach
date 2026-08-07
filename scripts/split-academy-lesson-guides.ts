/**
 * Move guide-length lesson bodies onto the Guide tab.
 *
 * Imported lessons put the whole written walkthrough in `body_markdown`, where
 * it renders squeezed beside the actions column on Overview. For every lesson
 * long and structured enough to be a guide, this copies the (normalized) body
 * into `guide_markdown` and replaces Overview with a short derived summary.
 *
 * Lessons that already have a guide are skipped, so re-runs are safe.
 *
 * Usage:
 *   npx tsx scripts/split-academy-lesson-guides.ts               (dry run)
 *   npx tsx scripts/split-academy-lesson-guides.ts --show        (dry run + output)
 *   npx tsx scripts/split-academy-lesson-guides.ts --apply       (backup + write)
 *   npx tsx scripts/split-academy-lesson-guides.ts --min-words 400
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { lessonGuideOutline } from "../src/lib/academy/lessonGuideOutline";
import { lessonOverviewFromGuide } from "../src/lib/academy/lessonOverviewFromGuide";
import { normalizeLessonMarkdown } from "../src/lib/academy/normalizeLessonMarkdown";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const show = process.argv.includes("--show");
/** Rebuild Overview from an existing guide (and re-normalize the guide). */
const force = process.argv.includes("--force");
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg === -1 ? null : process.argv[onlyArg + 1];
const minWordsArg = process.argv.indexOf("--min-words");
const MIN_WORDS = minWordsArg === -1 ? 300 : Number(process.argv[minWordsArg + 1]);
/** Below this a long body is one unstructured essay, not a guide. */
const MIN_HEADINGS = 2;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = {
  course_id: string;
  lesson_id: string;
  title: string | null;
  body_markdown: string | null;
  guide_markdown: string | null;
};

const wordCount = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

async function main() {
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("course_id, lesson_id, title, body_markdown, guide_markdown");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  const planned: { row: Row; guide: string; overview: string }[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    if (only && !row.lesson_id.includes(only)) continue;

    const existingGuide = (row.guide_markdown ?? "").trim();
    const body = row.body_markdown ?? "";

    if (force) {
      if (!existingGuide) {
        skipped.push(`${row.lesson_id} (no guide to rebuild from)`);
        continue;
      }
      const guide = normalizeLessonMarkdown(existingGuide);
      const draft = lessonOverviewFromGuide(guide);
      if (!draft.markdown.trim() || draft.leadWords < 8) {
        skipped.push(`${row.lesson_id} (no usable lead paragraph)`);
        continue;
      }
      planned.push({ row, guide, overview: draft.markdown });
      console.log(
        `force  lead=${String(draft.leadWords).padStart(2)}w  sections=${String(
          draft.sections.length
        ).padStart(2)}  ${row.lesson_id}`
      );
      if (show) {
        console.log("-".repeat(80));
        console.log(draft.markdown);
        console.log("-".repeat(80));
      }
      continue;
    }

    if (!body.trim()) continue;
    if (existingGuide) {
      skipped.push(`${row.lesson_id} (already has a guide)`);
      continue;
    }

    const words = wordCount(body);
    const headings = lessonGuideOutline(body).length;
    if (words < MIN_WORDS || headings < MIN_HEADINGS) continue;

    const guide = normalizeLessonMarkdown(body);
    const draft = lessonOverviewFromGuide(guide);

    if (!draft.markdown.trim() || draft.leadWords < 8) {
      skipped.push(`${row.lesson_id} (no usable lead paragraph)`);
      continue;
    }

    planned.push({ row, guide, overview: draft.markdown });

    console.log(
      `${String(words).padStart(5)}w  ${String(headings).padStart(2)}h  lead=${String(
        draft.leadWords
      ).padStart(2)}w  sections=${String(draft.sections.length).padStart(2)}  ${row.lesson_id}`
    );
    if (show) {
      console.log("-".repeat(80));
      console.log(draft.markdown);
      console.log("-".repeat(80));
    }
  }

  if (skipped.length > 0) {
    console.log(`\nskipped ${skipped.length}:`);
    skipped.forEach((s) => console.log(`  ${s}`));
  }

  if (apply && planned.length > 0) {
    const dir = join(process.cwd(), "scripts", "backups");
    mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join(dir, `academy-lesson-guide-split-${ts}.json`);
    writeFileSync(file, JSON.stringify(planned.map((p) => p.row), null, 2), "utf8");
    console.log(`\nbacked up ${planned.length} original rows to ${file}`);
  }

  let failed = 0;
  if (apply) {
    for (const { row, guide, overview } of planned) {
      const { error: upErr } = await supabase
        .from("academy_lesson_content")
        .update({
          guide_markdown: guide,
          body_markdown: overview,
          updated_at: new Date().toISOString(),
        })
        .eq("course_id", row.course_id)
        .eq("lesson_id", row.lesson_id);
      if (upErr) {
        console.error(`  failed ${row.lesson_id}: ${upErr.message}`);
        failed += 1;
      }
    }
  }

  console.log(
    `\n[split] apply=${apply} minWords=${MIN_WORDS} planned=${planned.length} failed=${failed} total=${rows.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

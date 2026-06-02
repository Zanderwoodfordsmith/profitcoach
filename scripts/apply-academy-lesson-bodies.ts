/**
 * Apply hand-reformatted lesson bodies to academy_lesson_content.body_markdown.
 *
 * Reads `<courseId>__<lessonId>.md` files from a directory (default
 * content/academy/reformatted), normalizes each via normalizeLessonMarkdown,
 * backs up the existing rows, and upserts ONLY body_markdown (title/video/
 * transcript untouched). This is the apply path for the "judgment" reformat pass
 * of lessons that aren't covered by the source docs.
 *
 * Usage:
 *   npx tsx scripts/apply-academy-lesson-bodies.ts --dry-run
 *   npx tsx scripts/apply-academy-lesson-bodies.ts --apply
 *   npx tsx scripts/apply-academy-lesson-bodies.ts --apply --dir content/academy/reformatted
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { normalizeLessonMarkdown } from "../src/lib/academy/normalizeLessonMarkdown";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const apply = argv.includes("--apply");

function argValue(flag: string): string | null {
  const idx = argv.indexOf(flag);
  return idx >= 0 && argv[idx + 1] && !argv[idx + 1]!.startsWith("-")
    ? argv[idx + 1]!
    : null;
}

const dir = path.resolve(argValue("--dir") ?? "content/academy/reformatted");

type Entry = { courseId: string; lessonId: string; body: string; file: string };

function parseEntries(): Entry[] {
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }
  const out: Entry[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const stem = file.slice(0, -3);
    const sep = stem.indexOf("__");
    if (sep < 0) {
      console.warn(`[skip] no '__' separator in filename: ${file}`);
      continue;
    }
    const courseId = stem.slice(0, sep);
    const lessonId = stem.slice(sep + 2);
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    out.push({ courseId, lessonId, body: normalizeLessonMarkdown(raw), file });
  }
  return out;
}

async function main() {
  if (dryRun === apply) {
    console.error("Specify exactly one of --dry-run or --apply.");
    process.exit(1);
  }
  const entries = parseEntries();
  if (entries.length === 0) {
    console.error(`No .md files in ${dir}`);
    process.exit(1);
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("course_id, lesson_id, body_markdown");
  if (error) {
    console.error(`Failed to read existing content: ${error.message}`);
    process.exit(1);
  }
  const existing = new Map<string, { body_markdown: string | null }>();
  for (const row of data ?? []) existing.set(`${row.course_id}:${row.lesson_id}`, row);

  console.log(`\n=== ${dryRun ? "Dry run" : "Apply"}: ${entries.length} reformatted lessons ===`);
  for (const e of entries) {
    const key = `${e.courseId}:${e.lessonId}`;
    const had = Boolean(existing.get(key)?.body_markdown?.trim());
    console.log(
      `  ${had ? "reformat" : "new     "} ${e.courseId}/${e.lessonId} [${e.body.length} chars]`
    );
  }

  if (dryRun) return;

  // Backup existing rows we are about to change.
  const backups = entries
    .map((e) => existing.get(`${e.courseId}:${e.lessonId}`) && { ...existing.get(`${e.courseId}:${e.lessonId}`)!, course_id: e.courseId, lesson_id: e.lessonId })
    .filter(Boolean);
  if (backups.length > 0) {
    const backupDir = path.join(process.cwd(), "scripts", "backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const f = path.join(backupDir, `academy-lesson-bodies-reformat-${ts}.json`);
    fs.writeFileSync(f, JSON.stringify(backups, null, 2), "utf8");
    console.log(`\nBacked up ${backups.length} rows to ${path.relative(process.cwd(), f)}`);
  }

  let updated = 0;
  let inserted = 0;
  let failed = 0;
  const now = new Date().toISOString();
  for (const e of entries) {
    const key = `${e.courseId}:${e.lessonId}`;
    if (existing.has(key)) {
      const { error: err } = await supabase
        .from("academy_lesson_content")
        .update({ body_markdown: e.body, updated_at: now })
        .eq("course_id", e.courseId)
        .eq("lesson_id", e.lessonId);
      if (err) {
        console.error(`  failed update ${key}: ${err.message}`);
        failed += 1;
      } else updated += 1;
    } else {
      const { error: err } = await supabase.from("academy_lesson_content").insert({
        course_id: e.courseId,
        lesson_id: e.lessonId,
        body_markdown: e.body,
        updated_at: now,
      });
      if (err) {
        console.error(`  failed insert ${key}: ${err.message}`);
        failed += 1;
      } else inserted += 1;
    }
  }
  console.log(`\nApplied: ${inserted} inserted, ${updated} updated, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

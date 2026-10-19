/**
 * Import Books & Talks (Vault) from content/academy/vault/books/*.md.
 *
 * Each file is one section: a `<!-- section ... -->` block, then its lessons,
 * each a `<!-- lesson ... -->` block of `key: value` lines (id, title, by,
 * video = YouTube id, length = video length) followed by the lesson's
 * Overview markdown.
 *
 * `--hub` rebuilds the `books` course in content/academy/vault-hub.json from
 * these files. `--apply` writes each lesson's video, Overview and length to
 * academy_lesson_content as a draft (admins only, kept out of search). Rows
 * that already exist are left alone so admin edits win, unless `--force`.
 * `--publish` clears the draft flag on every lesson so members see them.
 *
 * Prerequisites for --apply / --publish: `.env.local` with
 * NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage:
 *   npx tsx scripts/import-books-vault.ts                   (dry run: parse and report)
 *   npx tsx scripts/import-books-vault.ts --hub             (rewrite the hub entry)
 *   npx tsx scripts/import-books-vault.ts --apply           (new lessons, as drafts)
 *   npx tsx scripts/import-books-vault.ts --apply --force   (also overwrite existing rows)
 *   npx tsx scripts/import-books-vault.ts --publish         (show every lesson to members)
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { formatDurationMinutes, type HubCatalog, type HubCourse } from "../src/lib/academy/hubCatalog";

loadEnvConfig(process.cwd());

const COURSE_ID = "books";
const COURSE_TITLE = "Books & Talks";
const COURSE_DESCRIPTION =
  "The best ideas from 150 books and talks on mindset, focus, sales and running a business. Five minutes each, with how to use them with clients.";
const SOURCE_DIR = path.join(process.cwd(), "content/academy/vault/books");
const HUB_PATH = path.join(process.cwd(), "content/academy/vault-hub.json");
const READ_WORDS_PER_MINUTE = 200;

const argv = process.argv.slice(2);
const writeHub = argv.includes("--hub");
const apply = argv.includes("--apply");
const force = argv.includes("--force");
const publish = argv.includes("--publish");

type BooksLesson = {
  id: string;
  title: string;
  by: string | null;
  videoId: string | null;
  duration: string;
  bodyMarkdown: string;
};

type BooksSection = { id: string; title: string; lessons: BooksLesson[] };

const BLOCK = /<!--\s*(section|lesson)\s*\n([\s\S]*?)-->/g;

function parseMeta(raw: string, where: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon < 0) throw new Error(`${where}: expected "key: value", got "${trimmed}"`);
    meta[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
  }
  return meta;
}

function readMinutes(markdown: string): number {
  return Math.max(1, Math.ceil(markdown.split(/\s+/).filter(Boolean).length / READ_WORDS_PER_MINUTE));
}

function parseSectionFile(file: string): BooksSection {
  const text = fs.readFileSync(file, "utf8");
  const name = path.basename(file);
  const blocks = [...text.matchAll(BLOCK)];
  if (blocks[0]?.[1] !== "section") throw new Error(`${name}: must start with a <!-- section --> block`);
  const sectionMeta = parseMeta(blocks[0][2], name);
  if (!sectionMeta.id || !sectionMeta.title) throw new Error(`${name}: section needs id and title`);

  const lessons = blocks.slice(1).map((block, i) => {
    if (block[1] !== "lesson") throw new Error(`${name}: only one section block per file`);
    const meta = parseMeta(block[2], `${name} lesson ${i + 1}`);
    if (!meta.id?.startsWith(`${COURSE_ID}-`) || !meta.title) {
      throw new Error(`${name} lesson ${i + 1}: needs a title and an id starting "${COURSE_ID}-"`);
    }
    const end = blocks[i + 2]?.index ?? text.length;
    const bodyMarkdown = text.slice(block.index! + block[0].length, end).trim();
    if (!bodyMarkdown) throw new Error(`${name}: ${meta.id} has no body`);
    if (bodyMarkdown.includes("—")) throw new Error(`${name}: ${meta.id} has an em dash`);
    return {
      id: meta.id,
      title: meta.title,
      by: meta.by || null,
      videoId: meta.video || null,
      duration: meta.length || formatDurationMinutes(readMinutes(bodyMarkdown))!,
      bodyMarkdown,
    };
  });
  return { id: sectionMeta.id, title: sectionMeta.title, lessons };
}

function loadSections(): BooksSection[] {
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => path.join(SOURCE_DIR, f));
  const sections = files.map(parseSectionFile);
  const ids = sections.flatMap((s) => s.lessons.map((l) => l.id));
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) throw new Error(`Duplicate lesson id: ${duplicate}`);
  return sections;
}

function youtubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function buildHubCourse(sections: BooksSection[]): HubCourse {
  return {
    id: COURSE_ID,
    title: COURSE_TITLE,
    description: COURSE_DESCRIPTION,
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      lessons: section.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        duration: lesson.duration,
        hasVideo: Boolean(lesson.videoId),
        academyUrl: "",
      })),
    })),
  };
}

function rewriteHub(sections: BooksSection[]) {
  const catalog = JSON.parse(fs.readFileSync(HUB_PATH, "utf8")) as HubCatalog;
  const course = buildHubCourse(sections);
  const index = catalog.courses.findIndex((c) => c.id === COURSE_ID);
  if (index >= 0) catalog.courses[index] = course;
  else catalog.courses.push(course);
  fs.writeFileSync(HUB_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`[books] vault-hub.json: ${sections.length} sections`);
}

function supabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function importLessons(supabase: SupabaseClient, lessons: BooksLesson[]) {
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("lesson_id")
    .eq("course_id", COURSE_ID);
  if (error) throw new Error(error.message);
  const existing = new Set((data ?? []).map((row) => row.lesson_id as string));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (const lesson of lessons) {
    const values = {
      title: lesson.title,
      video_url: lesson.videoId ? youtubeUrl(lesson.videoId) : null,
      body_markdown: lesson.bodyMarkdown,
      duration: lesson.duration,
      updated_at: new Date().toISOString(),
    };
    if (existing.has(lesson.id)) {
      if (!force) {
        skipped += 1;
        continue;
      }
      const { error: updateError } = await supabase
        .from("academy_lesson_content")
        .update(values)
        .eq("course_id", COURSE_ID)
        .eq("lesson_id", lesson.id);
      if (updateError) throw new Error(`${lesson.id}: ${updateError.message}`);
      updated += 1;
    } else {
      const { error: insertError } = await supabase
        .from("academy_lesson_content")
        .insert({ course_id: COURSE_ID, lesson_id: lesson.id, is_draft: true, ...values });
      if (insertError) throw new Error(`${lesson.id}: ${insertError.message}`);
      inserted += 1;
    }
  }
  console.log(`[books] ${inserted} new (draft), ${updated} overwritten, ${skipped} left as edited`);
}

async function publishLessons(supabase: SupabaseClient, lessons: BooksLesson[]) {
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .update({ is_draft: false, updated_at: new Date().toISOString() })
    .eq("course_id", COURSE_ID)
    .in(
      "lesson_id",
      lessons.map((l) => l.id),
    )
    .select("lesson_id");
  if (error) throw new Error(error.message);
  console.log(`[books] published ${data?.length ?? 0} of ${lessons.length} lessons`);
}

async function main() {
  const sections = loadSections();
  const lessons = sections.flatMap((s) => s.lessons);
  for (const section of sections) {
    const videos = section.lessons.filter((l) => l.videoId).length;
    console.log(`[books] ${section.title}: ${section.lessons.length} lessons, ${videos} with video`);
  }
  console.log(`[books] ${lessons.length} lessons in ${sections.length} sections`);

  if (writeHub) rewriteHub(sections);
  if (apply || publish) {
    const supabase = supabaseClient();
    if (apply) await importLessons(supabase, lessons);
    if (publish) await publishLessons(supabase, lessons);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

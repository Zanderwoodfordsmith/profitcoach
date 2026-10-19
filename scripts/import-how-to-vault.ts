/**
 * Import How To (Vault) from content/academy/vault/how-to/*.md: short
 * how-to videos from the old Academy (Tech Made Easy, the Going Pro focus
 * setup videos, Pro Business), each with an Overview in our own words.
 *
 * Each file is one section: a `<!-- section ... -->` block, then its lessons,
 * each a `<!-- lesson ... -->` block of `key: value` lines followed by the
 * lesson's Overview markdown. Lesson keys:
 *   id, title         required (id starts "how-to-")
 *   file              video in the BCA archive, relative to --root
 *   copy              `<course>/<lesson>`: reuse that lesson's uploaded video
 *   length            video length for the hub (reading time when no video)
 *
 * `--hub` rebuilds the `how-to` course in content/academy/vault-hub.json.
 * `--apply` uploads each `file` video to academy-lessons/how-to/<lesson>/,
 * then writes title, video, Overview and length to academy_lesson_content.
 * New rows go in as drafts (admins only, kept out of search). On existing
 * rows it only fills empty fields, so admin edits win, unless `--force`.
 * `--publish` clears the draft flag on every lesson so members see them.
 *
 * Timed transcripts: scripts/transcribe-stryvx-whisper.ts --course how-to.
 *
 * Prerequisites for --apply / --publish: `.env.local` with
 * NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, and Google Drive for
 * desktop syncing the Business Coach Academy shared drive.
 *
 * Usage:
 *   npx tsx scripts/import-how-to-vault.ts                   (dry run: parse and report)
 *   npx tsx scripts/import-how-to-vault.ts --hub             (rewrite the hub entry)
 *   npx tsx scripts/import-how-to-vault.ts --apply           (upload videos, fill lessons as drafts)
 *   npx tsx scripts/import-how-to-vault.ts --apply --force   (also overwrite filled fields and re-upload)
 *   npx tsx scripts/import-how-to-vault.ts --publish         (show every lesson to members)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  formatDurationMinutes,
  formatLessonDurationFromSeconds,
  type HubCatalog,
  type HubCourse,
} from "../src/lib/academy/hubCatalog";
import { probeMediaDurationSeconds } from "./lib/probeMediaDuration";

loadEnvConfig(process.cwd());

const COURSE_ID = "how-to";
const COURSE_TITLE = "How To";
const COURSE_DESCRIPTION =
  "Short guides to the tools and set-up behind a coaching business: Zoom, Google Drive, passwords, a distraction-free phone and desktop, and the business basics.";
const SOURCE_DIR = path.join(process.cwd(), "content/academy/vault/how-to");
const HUB_PATH = path.join(process.cwd(), "content/academy/vault-hub.json");
const BUCKET = "academy-lessons";
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // academy-lessons bucket limit
const READ_WORDS_PER_MINUTE = 200;

const argv = process.argv.slice(2);
const writeHub = argv.includes("--hub");
const apply = argv.includes("--apply");
const force = argv.includes("--force");
const publish = argv.includes("--publish");
const rootIdx = argv.indexOf("--root");
const ROOT =
  rootIdx >= 0
    ? argv[rootIdx + 1]
    : path.join(
        os.homedir(),
        "Library/CloudStorage/GoogleDrive-zander@businesscoachacademy.com/Shared drives/Business Coach Academy/Tidy/Z. BCA archive (Apr 2026) All Old Files",
      );

type HowToLesson = {
  id: string;
  title: string;
  file: string | null;
  copy: { courseId: string; lessonId: string } | null;
  duration: string;
  bodyMarkdown: string;
};

type HowToSection = { id: string; title: string; lessons: HowToLesson[] };

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

function parseCopy(value: string | undefined, where: string): HowToLesson["copy"] {
  if (!value) return null;
  const [courseId, lessonId, extra] = value.split("/");
  if (!courseId || !lessonId || extra) throw new Error(`${where}: copy must be "<course>/<lesson>"`);
  return { courseId, lessonId };
}

function parseSectionFile(file: string): HowToSection {
  const text = fs.readFileSync(file, "utf8");
  const name = path.basename(file);
  const blocks = [...text.matchAll(BLOCK)];
  if (blocks[0]?.[1] !== "section") throw new Error(`${name}: must start with a <!-- section --> block`);
  const sectionMeta = parseMeta(blocks[0][2], name);
  if (!sectionMeta.id || !sectionMeta.title) throw new Error(`${name}: section needs id and title`);

  const lessons = blocks.slice(1).map((block, i) => {
    if (block[1] !== "lesson") throw new Error(`${name}: only one section block per file`);
    const where = `${name} lesson ${i + 1}`;
    const meta = parseMeta(block[2], where);
    if (!meta.id?.startsWith(`${COURSE_ID}-`) || !meta.title) {
      throw new Error(`${where}: needs a title and an id starting "${COURSE_ID}-"`);
    }
    if (meta.file && meta.copy) throw new Error(`${where}: use file or copy, not both`);
    const end = blocks[i + 2]?.index ?? text.length;
    const bodyMarkdown = text.slice(block.index! + block[0].length, end).trim();
    if (bodyMarkdown.includes("—")) throw new Error(`${name}: ${meta.id} has an em dash`);
    const hasVideo = Boolean(meta.file || meta.copy);
    return {
      id: meta.id,
      title: meta.title,
      file: meta.file || null,
      copy: parseCopy(meta.copy, where),
      duration: meta.length || (hasVideo || !bodyMarkdown ? "" : formatDurationMinutes(readMinutes(bodyMarkdown))!),
      bodyMarkdown,
    };
  });
  return { id: sectionMeta.id, title: sectionMeta.title, lessons };
}

function loadSections(): HowToSection[] {
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

function buildHubCourse(sections: HowToSection[]): HubCourse {
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
        hasVideo: Boolean(lesson.file || lesson.copy),
        academyUrl: "",
      })),
    })),
  };
}

function rewriteHub(sections: HowToSection[]) {
  const catalog = JSON.parse(fs.readFileSync(HUB_PATH, "utf8")) as HubCatalog;
  const course = buildHubCourse(sections);
  const index = catalog.courses.findIndex((c) => c.id === COURSE_ID);
  if (index >= 0) catalog.courses[index] = course;
  else catalog.courses.push(course);
  fs.writeFileSync(HUB_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`[how-to] vault-hub.json: ${sections.length} sections`);
}

function supabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

type ContentRow = {
  lesson_id: string;
  title: string | null;
  video_url: string | null;
  body_markdown: string | null;
  duration: string | null;
};

async function loadContentRows(supabase: SupabaseClient, courseId: string): Promise<Map<string, ContentRow>> {
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("lesson_id, title, video_url, body_markdown, duration")
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.lesson_id as string, row as ContentRow]));
}

async function uploadVideo(supabase: SupabaseClient, lesson: HowToLesson, file: string): Promise<string> {
  const storagePath = `${COURSE_ID}/${lesson.id}/source.mp4`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, fs.readFileSync(file), {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw new Error(`${storagePath}: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/** The video URL and length this lesson should have, uploading its file when needed. */
async function resolveVideo(
  supabase: SupabaseClient,
  lesson: HowToLesson,
  existing: ContentRow | undefined,
  copySources: Map<string, ContentRow>,
): Promise<{ videoUrl: string | null; duration: string | null }> {
  if (lesson.copy) {
    const source = copySources.get(`${lesson.copy.courseId}/${lesson.copy.lessonId}`);
    if (!source?.video_url) throw new Error(`${lesson.id}: ${lesson.copy.courseId}/${lesson.copy.lessonId} has no video`);
    return { videoUrl: source.video_url, duration: source.duration };
  }
  if (!lesson.file) return { videoUrl: null, duration: null };

  const hasOurVideo = existing?.video_url?.includes(`/${BUCKET}/${COURSE_ID}/${lesson.id}/`);
  if (hasOurVideo && !force) return { videoUrl: existing!.video_url, duration: existing!.duration };

  const file = path.join(ROOT, lesson.file);
  if (!fs.existsSync(file)) throw new Error(`${lesson.id}: video not found at ${file}`);
  const size = fs.statSync(file).size;
  if (size > MAX_VIDEO_BYTES) throw new Error(`${file} is over the 2 GB bucket limit`);
  const seconds = await probeMediaDurationSeconds(file);
  const videoUrl = await uploadVideo(supabase, lesson, file);
  const duration = seconds ? formatLessonDurationFromSeconds(seconds) : null;
  console.log(`[how-to] uploaded ${lesson.id} (${(size / 1024 / 1024).toFixed(1)} MB, ${duration ?? "?"})`);
  return { videoUrl, duration };
}

async function importLessons(supabase: SupabaseClient, lessons: HowToLesson[]) {
  const existing = await loadContentRows(supabase, COURSE_ID);
  const copySources = new Map<string, ContentRow>();
  for (const courseId of new Set(lessons.flatMap((l) => (l.copy ? [l.copy.courseId] : [])))) {
    for (const [lessonId, row] of await loadContentRows(supabase, courseId)) {
      copySources.set(`${courseId}/${lessonId}`, row);
    }
  }

  let inserted = 0;
  let updated = 0;
  for (const lesson of lessons) {
    const row = existing.get(lesson.id);
    const video = await resolveVideo(supabase, lesson, row, copySources);
    const wanted: Partial<Record<keyof ContentRow, string | null>> = {
      title: lesson.title,
      video_url: video.videoUrl,
      body_markdown: lesson.bodyMarkdown || null,
      duration: video.duration ?? (lesson.duration || null),
    };
    if (!row) {
      const { error } = await supabase.from("academy_lesson_content").insert({
        course_id: COURSE_ID,
        lesson_id: lesson.id,
        is_draft: true,
        ...wanted,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(`${lesson.id}: ${error.message}`);
      inserted += 1;
      continue;
    }
    // Fill only what is empty, so admin edits win (unless --force).
    const changes = Object.fromEntries(
      Object.entries(wanted).filter(
        ([key, value]) => value && value !== row[key as keyof ContentRow] && (force || !row[key as keyof ContentRow]),
      ),
    );
    if (Object.keys(changes).length === 0) continue;
    const { error } = await supabase
      .from("academy_lesson_content")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("course_id", COURSE_ID)
      .eq("lesson_id", lesson.id);
    if (error) throw new Error(`${lesson.id}: ${error.message}`);
    updated += 1;
    console.log(`[how-to] ${lesson.id}: set ${Object.keys(changes).join(", ")}`);
  }
  console.log(`[how-to] ${inserted} new (draft), ${updated} updated`);
}

async function publishLessons(supabase: SupabaseClient, lessons: HowToLesson[]) {
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
  console.log(`[how-to] published ${data?.length ?? 0} of ${lessons.length} lessons`);
}

async function main() {
  const sections = loadSections();
  const lessons = sections.flatMap((s) => s.lessons);
  for (const section of sections) {
    const videos = section.lessons.filter((l) => l.file || l.copy).length;
    console.log(`[how-to] ${section.title}: ${section.lessons.length} lessons, ${videos} with video`);
  }
  for (const lesson of lessons) {
    if (!lesson.bodyMarkdown) console.log(`[how-to] ${lesson.id}: no Overview yet`);
    if (lesson.file && !fs.existsSync(path.join(ROOT, lesson.file))) {
      console.log(`[how-to] ${lesson.id}: MISSING video ${lesson.file}`);
    }
  }
  console.log(`[how-to] ${lessons.length} lessons in ${sections.length} sections`);

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

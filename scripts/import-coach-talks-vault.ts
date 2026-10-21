/**
 * Import From our coaches (Vault) from content/academy/vault/coach-talks/*.md:
 * single talks by BCA coaches (Thursday Profit Coach Training sessions and
 * conference talks), shown as a row of videos under the Vault course cards.
 *
 * Same file format as scripts/import-how-to-vault.ts: one `<!-- section -->`
 * block, then `<!-- lesson -->` blocks of `key: value` lines, each followed by
 * the lesson's Overview markdown. Lesson keys:
 *   id, title         required (id starts "coach-talks-")
 *   file              trimmed, web-ready MP4, relative to --root
 *   transcript        mlx-whisper JSON of the untrimmed recording, relative to --root
 *   keep              the parts of the untrimmed recording the video keeps, in
 *                     seconds ("83-3462" or "1199-1720, 2987-3797"); the
 *                     transcript is cut and shifted to match. Omit to keep it all.
 *
 * `--hub` rebuilds the `coach-talks` course in content/academy/vault-hub.json.
 * `--apply` uploads each video (resumable upload, files are hundreds of MB)
 * to academy-lessons/coach-talks/<lesson>/, then writes title, video, Overview,
 * transcript and length to academy_lesson_content. New rows go in as drafts;
 * existing rows only get empty fields filled, unless `--force`.
 * `--publish` clears the draft flag on every lesson so members see them.
 *
 * Usage:
 *   npx tsx scripts/import-coach-talks-vault.ts --root <dir>                  (dry run)
 *   npx tsx scripts/import-coach-talks-vault.ts --root <dir> --hub
 *   npx tsx scripts/import-coach-talks-vault.ts --root <dir> --apply [--force]
 *   npx tsx scripts/import-coach-talks-vault.ts --publish
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { formatLessonDurationFromSeconds, type HubCatalog, type HubCourse } from "../src/lib/academy/hubCatalog";
import { probeMediaDurationSeconds } from "./lib/probeMediaDuration";

loadEnvConfig(process.cwd());

const COURSE_ID = "coach-talks";
const COURSE_TITLE = "From our coaches";
const COURSE_DESCRIPTION =
  "Talks from coaches in the Academy: how they won the work, what they ran and what they would do again.";
const SOURCE_DIR = path.join(process.cwd(), "content/academy/vault/coach-talks");
const HUB_PATH = path.join(process.cwd(), "content/academy/vault-hub.json");
const BUCKET = "academy-lessons";
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // academy-lessons bucket limit
const TUS_CHUNK_BYTES = 6 * 1024 * 1024; // Supabase resumable uploads take 6 MB chunks

const argv = process.argv.slice(2);
const writeHub = argv.includes("--hub");
const apply = argv.includes("--apply");
const force = argv.includes("--force");
const publish = argv.includes("--publish");
const rootIdx = argv.indexOf("--root");
const ROOT = rootIdx >= 0 ? argv[rootIdx + 1] : process.cwd();

type TalkLesson = {
  id: string;
  title: string;
  file: string | null;
  transcript: string | null;
  keep: Array<[number, number]> | null;
  bodyMarkdown: string;
};

type TalkSection = { id: string; title: string; lessons: TalkLesson[] };

type Segment = { start: number; end: number; text: string };

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

function parseKeep(value: string | undefined, where: string): TalkLesson["keep"] {
  if (!value) return null;
  return value.split(",").map((range) => {
    const [from, to] = range.trim().split("-").map(Number);
    if (!(from >= 0) || !(to > from)) throw new Error(`${where}: keep ranges look like "83-3462"`);
    return [from, to] as [number, number];
  });
}

function parseSectionFile(file: string): TalkSection {
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
    const end = blocks[i + 2]?.index ?? text.length;
    const bodyMarkdown = text.slice(block.index! + block[0].length, end).trim();
    if (bodyMarkdown.includes("—")) throw new Error(`${name}: ${meta.id} has an em dash`);
    return {
      id: meta.id,
      title: meta.title,
      file: meta.file || null,
      transcript: meta.transcript || null,
      keep: parseKeep(meta.keep, where),
      bodyMarkdown,
    };
  });
  return { id: sectionMeta.id, title: sectionMeta.title, lessons };
}

function loadSections(): TalkSection[] {
  return fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parseSectionFile(path.join(SOURCE_DIR, f)));
}

function videoPath(lesson: TalkLesson): string | null {
  return lesson.file ? path.join(ROOT, lesson.file) : null;
}

async function lessonDuration(lesson: TalkLesson): Promise<string> {
  const file = videoPath(lesson);
  if (!file || !fs.existsSync(file)) return "";
  const seconds = await probeMediaDurationSeconds(file);
  return seconds ? (formatLessonDurationFromSeconds(seconds) ?? "") : "";
}

async function buildHubCourse(sections: TalkSection[]): Promise<HubCourse> {
  return {
    id: COURSE_ID,
    title: COURSE_TITLE,
    description: COURSE_DESCRIPTION,
    sections: await Promise.all(
      sections.map(async (section) => ({
        id: section.id,
        title: section.title,
        lessons: await Promise.all(
          section.lessons.map(async (lesson) => ({
            id: lesson.id,
            title: lesson.title,
            duration: await lessonDuration(lesson),
            hasVideo: Boolean(lesson.file),
            academyUrl: "",
          })),
        ),
      })),
    ),
  };
}

async function rewriteHub(sections: TalkSection[]) {
  const catalog = JSON.parse(fs.readFileSync(HUB_PATH, "utf8")) as HubCatalog;
  const course = await buildHubCourse(sections);
  const index = catalog.courses.findIndex((c) => c.id === COURSE_ID);
  if (index >= 0) catalog.courses[index] = course;
  else catalog.courses.push(course);
  fs.writeFileSync(HUB_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`[coach-talks] vault-hub.json: ${course.sections[0]?.lessons.length ?? 0} talks`);
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `[${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}]`;
}

/** Whisper segments inside the kept parts, on the trimmed video's clock, as `[hh:mm:ss] text` lines (same as transcribe-stryvx-whisper.ts). */
function timedTranscript(lesson: TalkLesson): string | null {
  if (!lesson.transcript) return null;
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, lesson.transcript), "utf8")) as { segments: Segment[] };
  const keep = lesson.keep ?? [[0, Number.POSITIVE_INFINITY]];
  const segments = json.segments.flatMap((s) => {
    let offset = 0;
    for (const [from, to] of keep) {
      if (s.start >= from && s.start < to) {
        return [{ start: s.start - from + offset, end: Math.min(s.end, to) - from + offset, text: s.text.trim() }];
      }
      offset += to - from;
    }
    return [];
  }).filter((s) => s.text);
  const lines: string[] = [];
  let start: number | null = null;
  let parts: string[] = [];
  for (const segment of segments) {
    if (start === null) start = segment.start;
    parts.push(segment.text);
    const span = segment.end - start;
    if ((span >= 30 && /[.!?]["')\]]?$/.test(segment.text)) || span >= 60) {
      lines.push(`${clock(start)} ${parts.join(" ").replace(/\s+/g, " ")}`);
      start = null;
      parts = [];
    }
  }
  if (start !== null && parts.length) lines.push(`${clock(start)} ${parts.join(" ").replace(/\s+/g, " ")}`);
  return lines.join("\n") || null;
}

function supabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Resumable (TUS) upload: the plain upload endpoint rejects files this size. */
async function uploadLarge(file: string, storagePath: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const size = fs.statSync(file).size;
  const b64 = (value: string) => Buffer.from(value).toString("base64");
  const auth = { authorization: `Bearer ${key}`, apikey: key, "tus-resumable": "1.0.0" };

  const create = await fetch(`${base}/storage/v1/upload/resumable`, {
    method: "POST",
    headers: {
      ...auth,
      "upload-length": String(size),
      "x-upsert": "true",
      "upload-metadata": [
        `bucketName ${b64(BUCKET)}`,
        `objectName ${b64(storagePath)}`,
        `contentType ${b64("video/mp4")}`,
        `cacheControl ${b64("3600")}`,
      ].join(","),
    },
  });
  const location = create.headers.get("location");
  if (create.status !== 201 || !location) throw new Error(`${storagePath}: create upload ${create.status} ${await create.text()}`);

  const handle = fs.openSync(file, "r");
  try {
    for (let offset = 0; offset < size; offset += TUS_CHUNK_BYTES) {
      const length = Math.min(TUS_CHUNK_BYTES, size - offset);
      const chunk = Buffer.alloc(length);
      fs.readSync(handle, chunk, 0, length, offset);
      const res = await fetch(location, {
        method: "PATCH",
        headers: { ...auth, "upload-offset": String(offset), "content-type": "application/offset+octet-stream" },
        body: chunk,
      });
      if (res.status !== 204) throw new Error(`${storagePath}: chunk at ${offset} ${res.status} ${await res.text()}`);
    }
  } finally {
    fs.closeSync(handle);
  }
}

type ContentRow = {
  lesson_id: string;
  title: string | null;
  video_url: string | null;
  body_markdown: string | null;
  transcript_text: string | null;
  duration: string | null;
};

async function importLessons(supabase: SupabaseClient, lessons: TalkLesson[]) {
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("lesson_id, title, video_url, body_markdown, transcript_text, duration")
    .eq("course_id", COURSE_ID);
  if (error) throw new Error(error.message);
  const existing = new Map((data ?? []).map((row) => [row.lesson_id as string, row as ContentRow]));

  for (const lesson of lessons) {
    const row = existing.get(lesson.id);
    let videoUrl = row?.video_url ?? null;
    const file = videoPath(lesson);
    const hasOurVideo = videoUrl?.includes(`/${BUCKET}/${COURSE_ID}/${lesson.id}/`);
    if (file && (!hasOurVideo || force)) {
      if (!fs.existsSync(file)) throw new Error(`${lesson.id}: video not found at ${file}`);
      const size = fs.statSync(file).size;
      if (size > MAX_VIDEO_BYTES) throw new Error(`${file} is over the 2 GB bucket limit`);
      const storagePath = `${COURSE_ID}/${lesson.id}/source.mp4`;
      await uploadLarge(file, storagePath);
      videoUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
      console.log(`[coach-talks] uploaded ${lesson.id} (${(size / 1024 / 1024).toFixed(1)} MB)`);
    }

    const wanted: Partial<Record<keyof ContentRow, string | null>> = {
      title: lesson.title,
      video_url: videoUrl,
      body_markdown: lesson.bodyMarkdown || null,
      transcript_text: timedTranscript(lesson),
      duration: (await lessonDuration(lesson)) || null,
    };
    if (!row) {
      const { error: insertError } = await supabase.from("academy_lesson_content").insert({
        course_id: COURSE_ID,
        lesson_id: lesson.id,
        is_draft: true,
        ...wanted,
        updated_at: new Date().toISOString(),
      });
      if (insertError) throw new Error(`${lesson.id}: ${insertError.message}`);
      console.log(`[coach-talks] ${lesson.id}: new (draft)`);
      continue;
    }
    // Fill only what is empty, so admin edits win (unless --force).
    const changes = Object.fromEntries(
      Object.entries(wanted).filter(
        ([k, value]) => value && value !== row[k as keyof ContentRow] && (force || !row[k as keyof ContentRow]),
      ),
    );
    if (Object.keys(changes).length === 0) continue;
    const { error: updateError } = await supabase
      .from("academy_lesson_content")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("course_id", COURSE_ID)
      .eq("lesson_id", lesson.id);
    if (updateError) throw new Error(`${lesson.id}: ${updateError.message}`);
    console.log(`[coach-talks] ${lesson.id}: set ${Object.keys(changes).join(", ")}`);
  }
}

async function publishLessons(supabase: SupabaseClient, lessons: TalkLesson[]) {
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
  console.log(`[coach-talks] published ${data?.length ?? 0} of ${lessons.length} talks`);
}

async function main() {
  const sections = loadSections();
  const lessons = sections.flatMap((s) => s.lessons);
  for (const lesson of lessons) {
    const file = videoPath(lesson);
    const transcript = lesson.transcript ? path.join(ROOT, lesson.transcript) : null;
    console.log(
      `[coach-talks] ${lesson.id}: ${file && fs.existsSync(file) ? "video ok" : "NO VIDEO"}, ${
        transcript && fs.existsSync(transcript) ? "transcript ok" : "no transcript"
      }, ${lesson.bodyMarkdown ? "overview ok" : "no overview"}`,
    );
  }

  if (writeHub) await rewriteHub(sections);
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

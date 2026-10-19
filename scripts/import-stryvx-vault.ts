/**
 * Import the StryvX programme (Vault) from the synced Stryv shared drive:
 * lesson videos, worksheets, and old untimed transcripts as a stopgap.
 *
 * Lessons and order come from content/academy/vault-hub.json. Each video is a
 * source lesson (`stryvx-<module>-<lesson>-<slug>`, matching the
 * `<module>.<lesson> Title.mp4` files in Products/StryvX/StryvX Videos). Runs
 * of short videos are merged into one lesson: its `chapterSources` list the
 * source lessons, and this script mirrors them to that lesson's
 * academy_lesson_content.video_chapters.
 *
 * Timed transcripts come from Happy Scribe (scripts/queue-stryvx-transcripts.ts).
 * `--transcripts` only fills lessons that have no transcript and no live
 * Happy Scribe job, so it never replaces a timed transcript.
 *
 * Prerequisites: `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
 * and Google Drive for desktop syncing the Stryv shared drive.
 *
 * Usage:
 *   npx tsx scripts/import-stryvx-vault.ts --dry-run
 *   npx tsx scripts/import-stryvx-vault.ts --apply                  (videos + worksheets)
 *   npx tsx scripts/import-stryvx-vault.ts --apply --transcripts    (also stopgap transcripts)
 *   npx tsx scripts/import-stryvx-vault.ts --apply --skip-videos --transcripts
 *   npx tsx scripts/import-stryvx-vault.ts --apply --only stryvx-1-1-welcome-to-stryvx --force-videos
 *   npx tsx scripts/import-stryvx-vault.ts --dry-run --root "/path/to/Shared drives/Stryv"
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  formatDurationMinutes,
  formatLessonDurationFromSeconds,
  type HubCatalog,
} from "../src/lib/academy/hubCatalog";
import { stripTranscriptSpeakerLabels } from "../src/lib/academy/stripTranscriptSpeakerLabels";
import { probeMediaDurationSeconds } from "./lib/probeMediaDuration";

loadEnvConfig(process.cwd());

const COURSE_ID = "stryvx";
const BUCKET = "academy-lessons";
const RESOURCE_SECTION_ID = "vault/stryvx";
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // academy-lessons bucket limit

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const dryRun = !apply || argv.includes("--dry-run");
const skipVideos = argv.includes("--skip-videos");
const skipWorksheets = argv.includes("--skip-worksheets");
const withTranscripts = argv.includes("--transcripts");
const forceVideos = argv.includes("--force-videos");
const onlyIdx = argv.indexOf("--only");
const onlyLessonId = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
const rootIdx = argv.indexOf("--root");
const ROOT =
  rootIdx >= 0
    ? argv[rootIdx + 1]
    : path.join(
        os.homedir(),
        "Library/CloudStorage/GoogleDrive-zander@businesscoachacademy.com/Shared drives/Stryv",
      );

const PRODUCT_DIR = path.join(ROOT, "Products/StryvX");
const VIDEOS_DIR = path.join(PRODUCT_DIR, "StryvX Videos");
const RESOURCES_DIR = path.join(PRODUCT_DIR, "StryvX Resources");
const TRANSCRIPTS_DIR = path.join(ROOT, "z | Stryv Collection Box/Stryv Zip/Modules");

/** Module 13 (After StryvX) videos sit outside the numbered module folders. */
const WRAP_UP_VIDEOS: Record<number, string> = {
  1: path.join(VIDEOS_DIR, "Dynamics of Change review.mp4"),
  2: path.join(VIDEOS_DIR, "StryvX Exercise Review.mp4"),
  3: path.join(PRODUCT_DIR, "Stryv X Quiz.mp4"),
  4: path.join(PRODUCT_DIR, "Beyond Stryv X.mp4"),
};

/** Transcripts whose file names do not match the lesson title (relative to TRANSCRIPTS_DIR). */
const TRANSCRIPT_OVERRIDES: Record<string, string> = {
  "1.1": "Module 1 Foundations/Stryv X Welcome - Transcript [3m19s].docx",
  "1.2": "Module 1 Foundations/What is Stryv X - Transcript [8m35s].docx",
  "1.3": "Module 1 Foundations/Stryv X Prog Overview - Transcript [9m39s].docx",
  "1.4": "Module 1 Foundations/Stryv X Prg Success - Transcript [6m64s].docx",
  "1.8": "Module 1 Foundations/8. Hol grail of change 14m45s.docx",
  "2.1": "Module 2 Integral/Integral Intro [4m8s].docx",
  "3.9": "9. Personal Transformation - Level 6 [4m08s].docx",
  "5.1": "Pressure Vs Performance [7m46s].docx",
  "5.2": "5.3 Performance Model [8m17s].docx",
  "7.10": "10. Values Overview _ Communication 6m55s.docx",
  "8.2": "2. Vision 2m37s.docx",
  "13.3": "Module 13 After StryvX/13.3 Stryv X Quiz 3m56s.docx",
};

type Worksheet = {
  file: string;
  title: string;
  kind: "pdf" | "spreadsheet" | "document" | "presentation";
  /** Lesson numbers as `module.lesson`, from the checklist's exercise list. */
  lessons: string[];
};

const range = (module: number, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${module}.${from + i}`);

const WORKSHEETS: Worksheet[] = [
  { file: path.join(RESOURCES_DIR, "Stryv-X-Programme-Checklist.pdf"), title: "StryvX Progress Tracker", kind: "pdf", lessons: ["1.1", "1.3"] },
  { file: path.join(RESOURCES_DIR, "Stryv-X-Outcomes-Goals.xlsx"), title: "Outcomes and Goals", kind: "spreadsheet", lessons: ["1.5"] },
  { file: path.join(RESOURCES_DIR, "Stryv-X-1-Page-Growth-Plan.xlsx"), title: "1-Page Growth Plan", kind: "spreadsheet", lessons: range(1, 5, 10) },
  { file: path.join(RESOURCES_DIR, "Applying-Integral.pdf"), title: "Applying Integral Worksheet", kind: "pdf", lessons: ["2.7"] },
  { file: path.join(RESOURCES_DIR, "Applying-Integral-Template.pptx"), title: "Applying Integral Template", kind: "presentation", lessons: ["2.7"] },
  { file: path.join(RESOURCES_DIR, "Personal-Tranformation-Model.png"), title: "Personal Transformation Model (diagram)", kind: "document", lessons: ["3.3"] },
  { file: path.join(RESOURCES_DIR, "Transformation-Tower-Worksheet.pdf"), title: "Transformation Tower Worksheet", kind: "pdf", lessons: ["3.10"] },
  { file: path.join(RESOURCES_DIR, "Applying-Performance.pdf"), title: "Applying Performance Worksheet", kind: "pdf", lessons: ["5.5"] },
  { file: path.join(RESOURCES_DIR, "Applying-Performance.xlsx"), title: "Applying Performance (spreadsheet)", kind: "spreadsheet", lessons: ["5.5"] },
  { file: path.join(RESOURCES_DIR, "V.I.S.I.O.N.-Creator.xlsx"), title: "V.I.S.I.O.N. Creator", kind: "spreadsheet", lessons: range(8, 1, 7) },
  { file: path.join(ROOT, "1. Stryv Marketing/StryvX/Purpose-Power-Sheet.doc.docx"), title: "Purpose Power Sheet", kind: "document", lessons: range(9, 2, 7) },
  { file: path.join(RESOURCES_DIR, "Feeling-Features.pdf"), title: "Feeling Features", kind: "pdf", lessons: ["11.5"] },
  { file: path.join(RESOURCES_DIR, "Positive-Emotion-Practice-Stryv.pdf"), title: "Positive Emotion Practice", kind: "pdf", lessons: ["11.6"] },
  { file: path.join(RESOURCES_DIR, "Stryv-Daily-Performance-Planner.pdf"), title: "Daily Performance Planner", kind: "pdf", lessons: ["12.6"] },
  { file: path.join(RESOURCES_DIR, "Stryv-Daily-Performance-Planner.xlsx"), title: "Daily Performance Planner (spreadsheet)", kind: "spreadsheet", lessons: ["12.6"] },
  { file: path.join(RESOURCES_DIR, "Dynamics-of-Change.png"), title: "Dynamics of Change (diagram)", kind: "document", lessons: ["13.1"] },
  { file: path.join(PRODUCT_DIR, "Stryv X Exercise Checklist.pdf"), title: "StryvX Exercise Checklist", kind: "pdf", lessons: ["13.2"] },
];

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
};

/** One video: a lesson of its own, or a chapter of a merged lesson. */
type VaultLesson = {
  id: string;
  title: string;
  module: number;
  index: number;
  number: string;
  /** Lesson shown in the hub (the merged lesson for chapters). */
  hubLessonId: string;
  /** Merged lesson title + chapter title, for matching old transcript files. */
  fullTitle: string;
};

type ChapterSource = { id: string; title: string; sourceLessonId: string; duration: string };

type MergedLesson = { id: string; chapters: ChapterSource[] };

type VaultHubLesson = HubCatalog["courses"][number]["sections"][number]["lessons"][number] & {
  chapterSources?: ChapterSource[];
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function sourceLesson(
  id: string,
  title: string,
  hub: { id: string; title: string },
): VaultLesson {
  const match = id.match(/^stryvx-(\d+)-(\d+)-/);
  if (!match) throw new Error(`Unexpected lesson id: ${id}`);
  const moduleNumber = Number(match[1]);
  const index = Number(match[2]);
  return {
    id,
    title,
    module: moduleNumber,
    index,
    number: `${moduleNumber}.${index}`,
    hubLessonId: hub.id,
    fullTitle: hub.id === id ? title : `${hub.title} ${title}`,
  };
}

/** Every video in course order, plus the merged lessons built from them. */
function loadCatalog(): { lessons: VaultLesson[]; merged: MergedLesson[] } {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content/academy/vault-hub.json"), "utf8"),
  ) as HubCatalog;
  const course = catalog.courses.find((c) => c.id === COURSE_ID);
  if (!course) throw new Error(`vault-hub.json has no ${COURSE_ID} course`);
  const lessons: VaultLesson[] = [];
  const merged: MergedLesson[] = [];
  for (const section of course.sections) {
    for (const lesson of section.lessons as VaultHubLesson[]) {
      if (lesson.chapterSources?.length) {
        merged.push({ id: lesson.id, chapters: lesson.chapterSources });
        for (const chapter of lesson.chapterSources) {
          lessons.push(sourceLesson(chapter.sourceLessonId, chapter.title, lesson));
        }
      } else {
        lessons.push(sourceLesson(lesson.id, lesson.title, lesson));
      }
    }
  }
  return { lessons, merged };
}

function publicUrl(storagePath: string): string {
  return `${SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

/** `7.7. Level 6 - Green.mp4` and `1.10 Developing Your Self.mp4` both resolve. */
function numberedFile(dir: string, number: string, ext: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const prefix = new RegExp(`^${number.replace(".", "\\.")}[.\\s]`);
  const hit = fs
    .readdirSync(dir)
    .find((name) => prefix.test(name) && name.toLowerCase().endsWith(ext));
  return hit ? path.join(dir, hit) : null;
}

function videoPathFor(lesson: VaultLesson): string | null {
  if (lesson.module === 13) return WRAP_UP_VIDEOS[lesson.index] ?? null;
  const folder = fs
    .readdirSync(VIDEOS_DIR)
    .find((name) => name.startsWith(`${lesson.module}. `));
  return folder ? numberedFile(path.join(VIDEOS_DIR, folder), lesson.number, ".mp4") : null;
}

const STOP_WORDS = new Set(["the", "a", "of", "to", "and", "vs", "stryv", "x", "stryvx", "i", "ii"]);

function titleTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/\.docx?$/, "")
      .replace(/\[[^\]]*\]|\d+m\d*s?|\d+(\.\d+)*/g, " ")
      .split(/[^a-z]+/)
      .map((word) => word.replace(/(al|s)$/, ""))
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

let transcriptFiles: string[] | null = null;

/**
 * The Stryv Zip transcripts are numbered, but some modules use their own
 * numbering (Behaviour, Performance, Values, Vision), so a number match must
 * also agree on the title.
 */
function transcriptPathFor(lesson: VaultLesson): string | null {
  const override = TRANSCRIPT_OVERRIDES[lesson.number];
  if (override) {
    const file = path.join(TRANSCRIPTS_DIR, override);
    return fs.existsSync(file) ? file : null;
  }
  if (!transcriptFiles) {
    transcriptFiles = [TRANSCRIPTS_DIR, ...fs.readdirSync(TRANSCRIPTS_DIR)
      .filter((name) => name.startsWith("Module "))
      .map((name) => path.join(TRANSCRIPTS_DIR, name))]
      .flatMap((dir) =>
        fs.readdirSync(dir)
          .filter((name) => name.toLowerCase().endsWith(".docx"))
          .map((name) => path.join(dir, name)),
      );
  }
  // Chapter names like "Level 1" need their merged lesson's title to match.
  const wants = [titleTokens(lesson.title), titleTokens(lesson.fullTitle)];
  const numbered = new RegExp(`^${lesson.number.replace(".", "\\.")}[.\\s]`);
  let best: { file: string; score: number } | null = null;
  for (const file of transcriptFiles) {
    const name = path.basename(file);
    const have = titleTokens(name);
    const score =
      Math.max(...wants.map((want) => overlap(want, have))) + (numbered.test(name) ? 0.25 : 0);
    if (!best || score > best.score) best = { file, score };
  }
  return best && best.score >= 0.75 ? best.file : null;
}

function readDocxText(filePath: string): string {
  const xml = execFileSync("unzip", ["-p", filePath, "word/document.xml"], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  return xml
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ContentRow = {
  lesson_id: string;
  video_url: string | null;
  transcript_text: string | null;
  duration: string | null;
};

async function loadContentRows(): Promise<Map<string, ContentRow>> {
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("lesson_id, video_url, transcript_text, duration")
    .eq("course_id", COURSE_ID);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.lesson_id as string, row as ContentRow]));
}

/** Lessons with a Happy Scribe job that has not failed (it will write the timed transcript). */
async function loadLiveTranscriptionLessonIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("academy_transcription_items")
    .select("lesson_id")
    .eq("course_id", COURSE_ID)
    .neq("status", "failed");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.lesson_id as string));
}

async function upsertContent(
  lessonId: string,
  fields: {
    video_url?: string;
    duration?: string | null;
    transcript_text?: string;
    video_chapters?: { id: string; title: string; source_lesson_id: string; duration: string | null }[];
  },
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from("academy_lesson_content")
    .select("lesson_id")
    .eq("course_id", COURSE_ID)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  const values = { ...fields, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await supabase
        .from("academy_lesson_content")
        .update(values)
        .eq("course_id", COURSE_ID)
        .eq("lesson_id", lessonId)
    : await supabase
        .from("academy_lesson_content")
        .insert({ course_id: COURSE_ID, lesson_id: lessonId, ...values });
  if (error) throw new Error(error.message);
}

async function uploadFile(localPath: string, storagePath: string): Promise<string> {
  const ext = path.extname(localPath).toLowerCase();
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, fs.readFileSync(localPath), {
    contentType: MIME_BY_EXT[ext] ?? "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`${storagePath}: ${error.message}`);
  return publicUrl(storagePath);
}

function worksheetStoragePath(file: string): string {
  const base = path
    .basename(file)
    .replace(/\.doc\.docx$/i, ".docx")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${COURSE_ID}/worksheets/${base}`;
}

async function importVideos(lessons: VaultLesson[], rows: Map<string, ContentRow>) {
  let uploaded = 0;
  for (const lesson of lessons) {
    const file = videoPathFor(lesson);
    if (!file || !fs.existsSync(file)) {
      console.log(`[stryvx] MISSING video ${lesson.number} ${lesson.title}`);
      continue;
    }
    const existing = rows.get(lesson.id);
    const hasOurVideo = existing?.video_url?.includes(`/${BUCKET}/${COURSE_ID}/`);
    if (hasOurVideo && !forceVideos) {
      console.log(`[stryvx] skip ${lesson.number} (video already uploaded)`);
      continue;
    }
    const size = fs.statSync(file).size;
    if (size > MAX_VIDEO_BYTES) throw new Error(`${file} is over the 2 GB bucket limit`);
    const sizeMb = (size / 1024 / 1024).toFixed(1);
    if (dryRun) {
      console.log(`[stryvx] would upload ${lesson.number} ${lesson.title} (${sizeMb} MB) <- ${path.relative(ROOT, file)}`);
      continue;
    }
    const seconds = await probeMediaDurationSeconds(file);
    const url = await uploadFile(file, `${COURSE_ID}/${lesson.id}/source.mp4`);
    await upsertContent(lesson.id, {
      video_url: url,
      duration: seconds ? formatLessonDurationFromSeconds(seconds) : null,
    });
    uploaded += 1;
    console.log(`[stryvx] uploaded ${lesson.number} ${lesson.title} (${sizeMb} MB, ${seconds ? Math.round(seconds) : "?"}s)`);
  }
  console.log(`[stryvx] videos: ${dryRun ? "dry run" : `${uploaded} uploaded`}`);
}

async function importTranscripts(lessons: VaultLesson[], rows: Map<string, ContentRow>) {
  const live = await loadLiveTranscriptionLessonIds();
  let stored = 0;
  for (const lesson of lessons) {
    if (rows.get(lesson.id)?.transcript_text?.trim()) continue;
    if (live.has(lesson.id)) {
      console.log(`[stryvx] transcript ${lesson.number}: Happy Scribe job in progress, skipped`);
      continue;
    }
    const file = transcriptPathFor(lesson);
    if (!file) {
      console.log(`[stryvx] transcript ${lesson.number} ${lesson.title}: no confident match`);
      continue;
    }
    const text = stripTranscriptSpeakerLabels(readDocxText(file));
    if (!text) continue;
    if (dryRun) {
      console.log(`[stryvx] would store transcript ${lesson.number} ${lesson.title} <- ${path.basename(file)} (${text.length} chars)`);
      continue;
    }
    await upsertContent(lesson.id, { transcript_text: text });
    stored += 1;
    console.log(`[stryvx] stored transcript ${lesson.number} ${lesson.title} <- ${path.basename(file)}`);
  }
  console.log(`[stryvx] transcripts: ${dryRun ? "dry run" : `${stored} stored`}`);
}

async function importWorksheets(lessons: VaultLesson[]) {
  const byNumber = new Map(lessons.map((lesson) => [lesson.number, lesson]));
  for (const [sortOrder, sheet] of WORKSHEETS.entries()) {
    if (!fs.existsSync(sheet.file)) {
      console.log(`[stryvx] MISSING worksheet ${sheet.title} (${sheet.file})`);
      continue;
    }
    const targets = sheet.lessons
      .map((number) => byNumber.get(number))
      .filter((lesson): lesson is VaultLesson => Boolean(lesson))
      .filter((lesson) => !onlyLessonId || lesson.id === onlyLessonId);
    // Worksheets sit on the hub lesson, so a merged lesson gets each one once.
    const hubLessonIds = [...new Set(targets.map((lesson) => lesson.hubLessonId))];
    if (hubLessonIds.length === 0) continue;
    const storagePath = worksheetStoragePath(sheet.file);
    if (dryRun) {
      console.log(`[stryvx] would add worksheet "${sheet.title}" -> ${hubLessonIds.join(", ")}`);
      continue;
    }
    const url = await uploadFile(sheet.file, storagePath);
    const { data: resource, error } = await supabase
      .from("academy_resources")
      .upsert(
        {
          section_id: RESOURCE_SECTION_ID,
          title: sheet.title,
          url,
          resource_kind: sheet.kind,
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "section_id,url,title" },
      )
      .select("id")
      .single();
    if (error || !resource) throw new Error(error?.message ?? `Could not save ${sheet.title}`);
    const { error: linkError } = await supabase.from("academy_lesson_resources").upsert(
      hubLessonIds.map((lessonId) => ({
        course_id: COURSE_ID,
        lesson_id: lessonId,
        resource_id: resource.id,
        sort_order: sortOrder,
      })),
      { onConflict: "course_id,lesson_id,resource_id" },
    );
    if (linkError) throw new Error(linkError.message);
    if (!onlyLessonId) {
      // Drop links to lessons that are now chapters of a merged lesson.
      const { error: staleError } = await supabase
        .from("academy_lesson_resources")
        .delete()
        .eq("course_id", COURSE_ID)
        .eq("resource_id", resource.id)
        .not("lesson_id", "in", `(${hubLessonIds.join(",")})`);
      if (staleError) throw new Error(staleError.message);
    }
    console.log(`[stryvx] worksheet "${sheet.title}" -> ${hubLessonIds.join(", ")}`);
  }
}

/** Mirror each merged lesson's chapters (with their videos' lengths) to its content row. */
async function syncMergedLessons(merged: MergedLesson[]) {
  const rows = await loadContentRows();
  for (const lesson of merged) {
    const chapters = lesson.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      source_lesson_id: chapter.sourceLessonId,
      duration: rows.get(chapter.sourceLessonId)?.duration ?? chapter.duration,
    }));
    const minutes = chapters.reduce(
      (sum, chapter) => sum + (Number(chapter.duration?.replace(/m$/, "")) || 0),
      0,
    );
    const duration = formatDurationMinutes(minutes);
    if (dryRun) {
      console.log(`[stryvx] would set ${lesson.id}: ${chapters.length} chapters, ${duration}`);
      continue;
    }
    await upsertContent(lesson.id, { video_chapters: chapters, duration });
    console.log(`[stryvx] merged lesson ${lesson.id}: ${chapters.length} chapters, ${duration}`);
  }
}

async function main() {
  if (!fs.existsSync(VIDEOS_DIR)) {
    throw new Error(`StryvX videos not found at ${VIDEOS_DIR}. Is Google Drive for desktop syncing the Stryv shared drive?`);
  }
  const catalog = loadCatalog();
  const lessons = catalog.lessons.filter((lesson) => !onlyLessonId || lesson.id === onlyLessonId);
  if (lessons.length === 0) throw new Error(`No lesson matches ${onlyLessonId}`);
  console.log(`[stryvx] ${lessons.length} video lesson(s), ${dryRun ? "DRY RUN" : "APPLY"}`);

  const rows = await loadContentRows();
  if (!skipVideos) await importVideos(lessons, rows);
  if (!onlyLessonId) await syncMergedLessons(catalog.merged);
  if (!skipWorksheets) await importWorksheets(lessons);
  if (withTranscripts) await importTranscripts(lessons, await loadContentRows());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

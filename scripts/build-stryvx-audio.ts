/**
 * Listen mode for StryvX (Vault): one MP3 per lesson, cut from the live
 * lesson videos (so it always matches any trims), plus a single audiobook
 * (.m4b with a chapter per lesson) attached to the first lesson as one download.
 *
 * Merged lessons join their chapters' audio in order. Sets
 * academy_lesson_content.audio_url, which turns on the Watch / Listen switch.
 *
 * Needs ffmpeg on PATH (or ~/.local/bin/ffmpeg).
 *
 * Usage:
 *   npx tsx scripts/build-stryvx-audio.ts --dry-run
 *   npx tsx scripts/build-stryvx-audio.ts --work-dir <dir>
 *   npx tsx scripts/build-stryvx-audio.ts --work-dir <dir> --only stryvx-1-6-ownership
 *   npx tsx scripts/build-stryvx-audio.ts --work-dir <dir> --skip-lessons   (audiobook only)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import type { HubCatalog } from "../src/lib/academy/hubCatalog";

loadEnvConfig(process.cwd());

const COURSE_ID = "stryvx";
const BUCKET = "academy-lessons";
const RESOURCE_SECTION_ID = "vault/stryvx";
const AUDIOBOOK_TITLE = "StryvX audiobook (all lessons)";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const skipLessons = argv.includes("--skip-lessons");
const onlyIdx = argv.indexOf("--only");
const onlyLessonId = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
const workIdx = argv.indexOf("--work-dir");
const WORK_DIR = path.join(workIdx >= 0 ? argv[workIdx + 1] : os.tmpdir(), "stryvx-audio");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase env in .env.local");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const FFMPEG = fs.existsSync(path.join(os.homedir(), ".local/bin/ffmpeg"))
  ? path.join(os.homedir(), ".local/bin/ffmpeg")
  : "ffmpeg";

type ChapterSource = { sourceLessonId: string };
type HubLessonRow = { id: string; title: string; chapterSources?: ChapterSource[] };
type PlannedLesson = { id: string; title: string; moduleTitle: string; sourceIds: string[] };

function publicUrl(storagePath: string): string {
  return `${SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

function plan(): PlannedLesson[] {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content/academy/vault-hub.json"), "utf8"),
  ) as HubCatalog;
  const course = catalog.courses.find((c) => c.id === COURSE_ID);
  if (!course) throw new Error(`vault-hub.json has no ${COURSE_ID} course`);
  return course.sections.flatMap((section) =>
    (section.lessons as HubLessonRow[]).map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      moduleTitle: section.title,
      sourceIds: lesson.chapterSources?.length
        ? lesson.chapterSources.map((c) => c.sourceLessonId)
        : [lesson.id],
    })),
  );
}

function audioSeconds(file: string): number {
  let stderr = "";
  try {
    execFileSync(FFMPEG, ["-hide_banner", "-i", file], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    stderr = String((error as { stderr?: Buffer }).stderr ?? "");
  }
  const match = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Could not read duration of ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/** Mono 64 kbps MP3: clear for speech, about 29 MB an hour. */
function buildLessonMp3(videoUrls: string[], out: string) {
  const inputs = videoUrls.flatMap((url) => ["-i", url]);
  const filter =
    videoUrls.length > 1
      ? ["-filter_complex", `${videoUrls.map((_, i) => `[${i}:a]`).join("")}concat=n=${videoUrls.length}:v=0:a=1[a]`, "-map", "[a]"]
      : ["-vn"];
  execFileSync(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-y",
    ...inputs, ...filter,
    "-ac", "1", "-ar", "44100", "-b:a", "64k",
    out,
  ]);
}

async function upload(localPath: string, storagePath: string, contentType: string): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, fs.readFileSync(localPath), {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`${storagePath}: ${error.message}`);
  return publicUrl(storagePath);
}

async function buildLessons(lessons: PlannedLesson[], videoBySource: Map<string, string | null>) {
  let built = 0;
  for (const lesson of lessons) {
    const urls = lesson.sourceIds.map((id) => videoBySource.get(id) ?? null);
    if (urls.some((url) => !url)) {
      console.log(`[audio] skip ${lesson.id}: missing video for a chapter`);
      continue;
    }
    const mp3 = path.join(WORK_DIR, `${lesson.id}.mp3`);
    if (dryRun) {
      console.log(`[audio] would build ${lesson.id} from ${urls.length} video(s)`);
      continue;
    }
    buildLessonMp3(urls as string[], mp3);
    const url = await upload(mp3, `${COURSE_ID}/audio/${lesson.id}.mp3`, "audio/mpeg");
    const { error } = await supabase
      .from("academy_lesson_content")
      .update({ audio_url: url, updated_at: new Date().toISOString() })
      .eq("course_id", COURSE_ID)
      .eq("lesson_id", lesson.id);
    if (error) throw new Error(error.message);
    built += 1;
    console.log(`[audio] ${lesson.id}: ${(fs.statSync(mp3).size / 1024 / 1024).toFixed(1)} MB`);
  }
  console.log(`[audio] lessons: ${dryRun ? "dry run" : `${built} built`}`);
}

/** One .m4b with a chapter per lesson, from the lesson MP3s already in WORK_DIR. */
async function buildAudiobook(lessons: PlannedLesson[]) {
  const files = lessons.map((lesson) => ({ lesson, file: path.join(WORK_DIR, `${lesson.id}.mp3`) }));
  const missing = files.filter((f) => !fs.existsSync(f.file));
  if (missing.length) {
    console.log(`[audio] audiobook skipped: ${missing.length} lesson MP3s missing (run without --only first)`);
    return;
  }
  if (dryRun) {
    console.log(`[audio] would build audiobook from ${files.length} lessons`);
    return;
  }

  const listFile = path.join(WORK_DIR, "audiobook-list.txt");
  fs.writeFileSync(listFile, files.map((f) => `file '${f.file.replace(/'/g, "'\\''")}'`).join("\n"));

  const escape = (text: string) => text.replace(/([=;#\\\n])/g, "\\$1");
  let cursorMs = 0;
  const chapters = files.map(({ lesson, file }) => {
    const start = cursorMs;
    cursorMs += Math.round(audioSeconds(file) * 1000);
    const moduleName = lesson.moduleTitle.replace(/^\d+\.\s*/, "");
    return `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${start}\nEND=${cursorMs}\ntitle=${escape(`${moduleName}: ${lesson.title}`)}`;
  });
  const metadataFile = path.join(WORK_DIR, "audiobook-chapters.txt");
  fs.writeFileSync(
    metadataFile,
    `;FFMETADATA1\ntitle=StryvX\nartist=Zander Woodford-Smith\nalbum=StryvX\ngenre=Audiobook\n\n${chapters.join("\n\n")}\n`,
  );

  const m4b = path.join(WORK_DIR, "StryvX-audiobook.m4b");
  execFileSync(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "concat", "-safe", "0", "-i", listFile,
    "-i", metadataFile, "-map_metadata", "1", "-map_chapters", "1",
    "-map", "0:a", "-c:a", "aac", "-b:a", "48k", "-ac", "1",
    "-movflags", "+faststart", "-f", "mp4",
    m4b,
  ]);
  const sizeMb = (fs.statSync(m4b).size / 1024 / 1024).toFixed(0);
  const url = await upload(m4b, `${COURSE_ID}/audio/StryvX-audiobook.m4b`, "audio/mp4");

  const { data: resource, error } = await supabase
    .from("academy_resources")
    .upsert(
      {
        section_id: RESOURCE_SECTION_ID,
        title: AUDIOBOOK_TITLE,
        url,
        resource_kind: "book",
        sort_order: -1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "section_id,url,title" },
    )
    .select("id")
    .single();
  if (error || !resource) throw new Error(error?.message ?? "Could not save the audiobook resource");
  const { error: linkError } = await supabase.from("academy_lesson_resources").upsert(
    { course_id: COURSE_ID, lesson_id: lessons[0].id, resource_id: resource.id, sort_order: -1 },
    { onConflict: "course_id,lesson_id,resource_id" },
  );
  if (linkError) throw new Error(linkError.message);
  console.log(`[audio] audiobook: ${sizeMb} MB, ${(cursorMs / 3600000).toFixed(2)} h, ${chapters.length} chapters, linked to ${lessons[0].id}`);
}

async function main() {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const all = plan();
  const lessons = all.filter((lesson) => !onlyLessonId || lesson.id === onlyLessonId);
  if (lessons.length === 0) throw new Error(`No lesson matches ${onlyLessonId}`);

  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("lesson_id, video_url")
    .eq("course_id", COURSE_ID);
  if (error) throw new Error(error.message);
  const videoBySource = new Map((data ?? []).map((row) => [row.lesson_id as string, row.video_url as string | null]));

  console.log(`[audio] ${lessons.length} lesson(s)${dryRun ? " (dry run)" : ""}, work dir ${WORK_DIR}`);
  if (!skipLessons) await buildLessons(lessons, videoBySource);
  if (!onlyLessonId) await buildAudiobook(all);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

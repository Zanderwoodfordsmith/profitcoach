/**
 * Timed Vault transcripts (StryvX by default) with Whisper on Cloudflare
 * Workers AI, for videos Happy Scribe has not done (no transcript, or an old
 * untimed one). Writes the same `[hh:mm:ss] text` format the lesson player reads.
 *
 * Skips lessons with a live Happy Scribe job. Needs ffmpeg on PATH (or
 * ~/.local/bin/ffmpeg) and CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_WORKERS_AI_TOKEN.
 * Whisper costs about $0.0005 per audio minute.
 *
 * Usage:
 *   npx tsx scripts/transcribe-stryvx-whisper.ts --dry-run
 *   npx tsx scripts/transcribe-stryvx-whisper.ts --only stryvx-10-7-level-4-context
 *   npx tsx scripts/transcribe-stryvx-whisper.ts
 *   npx tsx scripts/transcribe-stryvx-whisper.ts --course how-to
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import type { HubCatalog } from "../src/lib/academy/hubCatalog";

loadEnvConfig(process.cwd());

const CHUNK_SECONDS = 600;
const WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo";

const argv = process.argv.slice(2);
const courseIdx = argv.indexOf("--course");
const COURSE_ID = courseIdx >= 0 ? argv[courseIdx + 1] : "stryvx";
const dryRun = argv.includes("--dry-run");
const onlyIdx = argv.indexOf("--only");
const onlyLessonId = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
const workIdx = argv.indexOf("--work-dir");
const WORK_ROOT = workIdx >= 0 ? argv[workIdx + 1] : os.tmpdir();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_TOKEN = process.env.CLOUDFLARE_WORKERS_AI_TOKEN;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase env in .env.local");
if (!CF_ACCOUNT || !CF_TOKEN) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_WORKERS_AI_TOKEN");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const FFMPEG = fs.existsSync(path.join(os.homedir(), ".local/bin/ffmpeg"))
  ? path.join(os.homedir(), ".local/bin/ffmpeg")
  : "ffmpeg";

type Segment = { start: number; end: number; text: string };

function isTimedTranscript(text: string | null | undefined): boolean {
  const first = (text ?? "").split("\n").find((line) => line.trim());
  return Boolean(first && /^\s*\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(first));
}

/** Every video lesson id in course order (merged lessons expand to their chapters). */
function courseOrder(): string[] {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content/academy/vault-hub.json"), "utf8"),
  ) as HubCatalog;
  const course = catalog.courses.find((c) => c.id === COURSE_ID);
  if (!course) throw new Error(`vault-hub.json has no ${COURSE_ID} course`);
  return course.sections.flatMap((section) =>
    section.lessons.flatMap((lesson) => {
      const chapters = (lesson as { chapterSources?: { sourceLessonId: string }[] }).chapterSources;
      return chapters?.length ? chapters.map((c) => c.sourceLessonId) : [lesson.id];
    }),
  );
}

function audioSeconds(file: string): number {
  // ffmpeg prints the duration on stderr and exits non-zero without an output file.
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

async function whisper(chunkFile: string): Promise<{ segments: Segment[]; text: string }> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${WHISPER_MODEL}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        audio: fs.readFileSync(chunkFile).toString("base64"),
        language: "en",
        vad_filter: true,
      }),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    result?: { text?: string; segments?: { start?: number; end?: number; text?: string }[] };
    errors?: { message?: string }[];
  };
  if (!response.ok || body.success === false || !body.result) {
    throw new Error(body.errors?.map((e) => e.message).join("; ") || `Whisper failed (${response.status})`);
  }
  const segments = (body.result.segments ?? []).flatMap((s) =>
    typeof s.start === "number" && typeof s.end === "number" && s.text?.trim()
      ? [{ start: s.start, end: s.end, text: s.text.trim() }]
      : [],
  );
  return { segments, text: body.result.text?.trim() ?? "" };
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `[${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}]`;
}

/** Group segments into ~30-60s paragraphs, breaking at sentence ends, like Happy Scribe's cues. */
function toTranscript(segments: Segment[]): string {
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
  return lines.join("\n");
}

async function transcribeLesson(lessonId: string, videoUrl: string, workDir: string): Promise<string> {
  const audio = path.join(workDir, `${lessonId}.mp3`);
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", videoUrl, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", audio]);
  const seconds = audioSeconds(audio);
  const segments: Segment[] = [];
  for (let offset = 0; offset < seconds; offset += CHUNK_SECONDS) {
    const chunk = path.join(workDir, `${lessonId}-${offset}.mp3`);
    execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(offset), "-t", String(CHUNK_SECONDS), "-i", audio, "-c", "copy", chunk]);
    const result = await whisper(chunk);
    if (result.segments.length === 0 && result.text) {
      segments.push({ start: offset, end: Math.min(offset + CHUNK_SECONDS, seconds), text: result.text });
    }
    for (const segment of result.segments) {
      segments.push({ start: segment.start + offset, end: segment.end + offset, text: segment.text });
    }
  }
  const transcript = toTranscript(segments);
  if (!transcript) throw new Error("Whisper returned no text");
  return transcript;
}

async function main() {
  const order = courseOrder();
  const [{ data: rows, error }, { data: live, error: liveError }] = await Promise.all([
    supabase
      .from("academy_lesson_content")
      .select("lesson_id, video_url, transcript_text, duration")
      .eq("course_id", COURSE_ID),
    supabase
      .from("academy_transcription_items")
      .select("lesson_id")
      .eq("course_id", COURSE_ID)
      .in("status", ["pending", "submitting", "submitted", "processing", "exporting"]),
  ]);
  if (error) throw new Error(error.message);
  if (liveError) throw new Error(liveError.message);
  const byLesson = new Map((rows ?? []).map((row) => [row.lesson_id as string, row]));
  const liveIds = new Set((live ?? []).map((row) => row.lesson_id as string));

  const todo = order.filter((id) => {
    const row = byLesson.get(id);
    return (
      (!onlyLessonId || id === onlyLessonId) &&
      row?.video_url &&
      !liveIds.has(id) &&
      !isTimedTranscript(row.transcript_text as string | null)
    );
  });
  console.log(`[whisper] ${todo.length} video(s) to transcribe${dryRun ? " (dry run)" : ""}`);
  if (dryRun) {
    for (const id of todo) console.log(`  ${id} (${byLesson.get(id)?.duration ?? "?"})`);
    return;
  }

  const workDir = fs.mkdtempSync(path.join(WORK_ROOT, `${COURSE_ID}-whisper-`));
  let done = 0;
  try {
    for (const id of todo) {
      try {
        const transcript = await transcribeLesson(id, byLesson.get(id)!.video_url as string, workDir);
        const { error: writeError } = await supabase
          .from("academy_lesson_content")
          .update({ transcript_text: transcript, updated_at: new Date().toISOString() })
          .eq("course_id", COURSE_ID)
          .eq("lesson_id", id);
        if (writeError) throw new Error(writeError.message);
        done += 1;
        console.log(`[whisper] ${id}: ${transcript.split("\n").length} cues`);
      } catch (lessonError) {
        console.error(`[whisper] ${id} FAILED: ${lessonError instanceof Error ? lessonError.message : lessonError}`);
      }
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  console.log(`[whisper] ${done} of ${todo.length} transcribed`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

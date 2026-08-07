/**
 * Upload Start Here lesson videos from the local Profit Coach Platform Uploads folder.
 *
 * Usage:
 *   npx tsx scripts/upload-start-here-platform-videos.ts
 *   npx tsx scripts/upload-start-here-platform-videos.ts --root "/path/to/folder"
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { probeLessonDurationLabel } from "./lib/probeMediaDuration";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

const DEFAULT_ROOT = path.join(
  process.env.HOME ?? "",
  "Desktop",
  "Profit Coach Platform Uploads"
);

const argv = process.argv.slice(2);
const rootIdx = argv.indexOf("--root");
const rootArg = rootIdx >= 0 ? argv[rootIdx + 1]?.trim() : null;
const importRoot = path.resolve(rootArg || DEFAULT_ROOT);

const MAPPINGS: Array<{ fileName: string; lessonId: string; title: string }> = [
  {
    fileName: "member wins.mp4",
    lessonId: "kickstart-welcome-member-wins",
    title: "Member Wins",
  },
  {
    fileName: "Pick your path.mp4",
    lessonId: "kickstart-welcome-pick-your-path",
    title: "Pick Your Path",
  },
  {
    fileName: "Introduce yourself.mp4",
    lessonId: "kickstart-welcome-introduce-yourself",
    title: "Introduce Yourself",
  },
  {
    fileName: "Classrom full.mp4",
    lessonId: "kickstart-welcome-classroom-tour",
    title: "Classroom Tour",
  },
  {
    fileName: "Calendar.mp4",
    lessonId: "kickstart-welcome-calendar-calls",
    title: "Calendar & Calls",
  },
  {
    fileName: "Support.mp4",
    lessonId: "kickstart-welcome-support",
    title: "Support",
  },
];

const COURSE_ID = "kickstart";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!fs.existsSync(importRoot) || !fs.statSync(importRoot).isDirectory()) {
  console.error(`Not a directory: ${importRoot}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function academyLessonVideoPublicUrl(storagePath: string): string {
  const base = SUPABASE_URL!.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/academy-lessons/${storagePath}`;
}

async function uploadLessonVideo(lessonId: string, filePath: string): Promise<string> {
  const size = fs.statSync(filePath).size;
  if (size > MAX_VIDEO_BYTES) {
    const sizeMb = Math.round((size / (1024 * 1024)) * 10) / 10;
    throw new Error(`Video is ${sizeMb}MB (max 2048MB): ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase().replace(".", "") || "mp4";
  const storagePath = `${COURSE_ID}/${lessonId}/source.${ext}`;
  const sizeMb = Math.round((size / (1024 * 1024)) * 10) / 10;
  console.log(`[start-here-upload] uploading ${lessonId} (${sizeMb} MB) → ${storagePath}`);

  const buf = fs.readFileSync(filePath);
  const mime =
    ext === "webm" ? "video/webm" : ext === "mov" ? "video/quicktime" : "video/mp4";

  const { error } = await supabase.storage.from("academy-lessons").upload(storagePath, buf, {
    contentType: mime,
    upsert: true,
  });
  if (error) throw new Error(error.message);

  console.log(`[start-here-upload] uploaded ${lessonId}`);
  return academyLessonVideoPublicUrl(storagePath);
}

async function upsertLessonVideo(input: {
  lessonId: string;
  videoUrl: string;
  duration: string | null;
}): Promise<void> {
  const { data: existing } = await supabase
    .from("academy_lesson_content")
    .select("*")
    .eq("course_id", COURSE_ID)
    .eq("lesson_id", input.lessonId)
    .maybeSingle();

  const row = {
    course_id: COURSE_ID,
    lesson_id: input.lessonId,
    title: existing?.title ?? null,
    video_url: input.videoUrl,
    audio_url: existing?.audio_url ?? null,
    body_markdown: existing?.body_markdown ?? null,
    guide_markdown: existing?.guide_markdown ?? null,
    transcript_text: existing?.transcript_text ?? null,
    duration: input.duration ?? existing?.duration ?? null,
    recommended_actions: existing?.recommended_actions ?? null,
    is_draft: existing?.is_draft ?? false,
    is_deleted: existing?.is_deleted ?? false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("academy_lesson_content")
    .upsert(row, { onConflict: "course_id,lesson_id" });
  if (error) throw new Error(error.message);
}

async function main() {
  console.log(`[start-here-upload] root=${importRoot}`);

  const present = new Set(
    fs.readdirSync(importRoot).filter((name) => !name.startsWith("."))
  );

  for (const mapping of MAPPINGS) {
    if (!present.has(mapping.fileName)) {
      throw new Error(`Missing video file: ${mapping.fileName}`);
    }
  }

  const extras = [...present].filter(
    (name) =>
      /\.(mp4|mov|webm)$/i.test(name) &&
      !MAPPINGS.some((m) => m.fileName === name)
  );
  if (extras.length) {
    console.warn(
      `[start-here-upload] ignoring unmatched video(s): ${extras.join(", ")}`
    );
  }

  for (const mapping of MAPPINGS) {
    const filePath = path.join(importRoot, mapping.fileName);
    const videoUrl = await uploadLessonVideo(mapping.lessonId, filePath);
    const duration = await probeLessonDurationLabel({ videoPath: filePath });
    await upsertLessonVideo({
      lessonId: mapping.lessonId,
      videoUrl,
      duration,
    });
    console.log(
      `[start-here-upload] linked ${mapping.title} ← ${mapping.fileName}${
        duration ? ` (${duration})` : ""
      }`
    );
  }

  console.log(`[start-here-upload] done (${MAPPINGS.length} videos)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

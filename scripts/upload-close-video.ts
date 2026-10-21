/**
 * Upload Desktop "How the close really works.mp4" onto its Client Closing lesson
 * and mark the curriculum board row live.
 *
 * Usage: npx tsx scripts/upload-close-video.ts
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { probeLessonDurationLabel } from "./lib/probeMediaDuration";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const COURSE_ID = "win-clients";
const LESSON_ID = "win-clients-client-closing-find-the-real-objection";

const VIDEO_PATH = path.join(
  process.env.HOME ?? "",
  "Desktop",
  "How the close really works.mp4"
);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!fs.existsSync(VIDEO_PATH)) {
  console.error(`Missing video: ${VIDEO_PATH}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function academyLessonVideoPublicUrl(storagePath: string): string {
  const base = SUPABASE_URL!.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/academy-lessons/${storagePath}`;
}

async function main() {
  const { data: existing, error: readError } = await supabase
    .from("academy_lesson_content")
    .select("*")
    .eq("course_id", COURSE_ID)
    .eq("lesson_id", LESSON_ID)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error(`No lesson row for ${LESSON_ID}`);

  const size = fs.statSync(VIDEO_PATH).size;
  const sizeMb = Math.round((size / (1024 * 1024)) * 10) / 10;
  const storagePath = `${COURSE_ID}/${LESSON_ID}/source.mp4`;
  console.log(`[close-video] uploading ${sizeMb} MB → ${storagePath}`);

  const { error: uploadError } = await supabase.storage
    .from("academy-lessons")
    .upload(storagePath, fs.readFileSync(VIDEO_PATH), {
      contentType: "video/mp4",
      upsert: true,
    });
  if (uploadError) throw new Error(uploadError.message);

  const videoUrl = academyLessonVideoPublicUrl(storagePath);
  const duration = await probeLessonDurationLabel({ videoPath: VIDEO_PATH });
  console.log(`[close-video] uploaded; duration=${duration ?? "unknown"}`);

  const { error } = await supabase
    .from("academy_lesson_content")
    .update({
      video_url: videoUrl,
      duration: duration ?? existing.duration ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("course_id", COURSE_ID)
    .eq("lesson_id", LESSON_ID);
  if (error) throw new Error(error.message);

  const { error: planError } = await supabase
    .from("curriculum_plan_items")
    .update({
      video_url: videoUrl,
      status: "live",
      updated_at: new Date().toISOString(),
    })
    .eq("lesson_id", LESSON_ID);
  if (planError) throw new Error(planError.message);

  console.log(`[close-video] linked lesson ${LESSON_ID} (${existing.title})`);
  console.log(`[close-video] videoUrl=${videoUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

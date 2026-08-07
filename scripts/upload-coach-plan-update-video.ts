/**
 * Upload Desktop "Coach Plan Update.mp4" onto the CAP opener lesson.
 *
 * Usage: npx tsx scripts/upload-coach-plan-update-video.ts
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { probeLessonDurationLabel } from "./lib/probeMediaDuration";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const COURSE_ID = "coach-action-plan";
const LESSON_ID = "coach-action-plan-why-your-action-plan-looks-different";
const TITLE = "📣 Why your Action Plan looks different now";
const BODY = `## A quick update before you plan

Watch this short update before you work through the rest of Coach Action Plan.

Parts of the old Action Plan are intentionally light right now. We are shipping tools inside Profit Coach that do more of that setup for you — so there is no point teaching a long manual process you will not need to run by hand.

Use this video to understand what to focus on now, what can wait, and how the £10k/mo model still anchors everything that follows.`;

const VIDEO_PATH = path.join(
  process.env.HOME ?? "",
  "Desktop",
  "Coach Plan Update.mp4"
);

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

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
  const size = fs.statSync(VIDEO_PATH).size;
  if (size > MAX_VIDEO_BYTES) {
    throw new Error(`Video too large: ${VIDEO_PATH}`);
  }

  const sizeMb = Math.round((size / (1024 * 1024)) * 10) / 10;
  const storagePath = `${COURSE_ID}/${LESSON_ID}/source.mp4`;
  console.log(`[cap-update] uploading ${sizeMb} MB → ${storagePath}`);

  const buf = fs.readFileSync(VIDEO_PATH);
  const { error: uploadError } = await supabase.storage
    .from("academy-lessons")
    .upload(storagePath, buf, {
      contentType: "video/mp4",
      upsert: true,
    });
  if (uploadError) throw new Error(uploadError.message);

  const videoUrl = academyLessonVideoPublicUrl(storagePath);
  const duration = await probeLessonDurationLabel({ videoPath: VIDEO_PATH });
  console.log(`[cap-update] uploaded; duration=${duration ?? "unknown"}`);

  const { data: existing } = await supabase
    .from("academy_lesson_content")
    .select("*")
    .eq("course_id", COURSE_ID)
    .eq("lesson_id", LESSON_ID)
    .maybeSingle();

  const row = {
    course_id: COURSE_ID,
    lesson_id: LESSON_ID,
    title: existing?.title ?? TITLE,
    video_url: videoUrl,
    audio_url: existing?.audio_url ?? null,
    body_markdown: existing?.body_markdown?.trim()
      ? existing.body_markdown
      : BODY,
    guide_markdown: existing?.guide_markdown ?? null,
    transcript_text: existing?.transcript_text ?? null,
    duration: duration ?? existing?.duration ?? null,
    recommended_actions: existing?.recommended_actions ?? [],
    is_draft: false,
    is_deleted: false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("academy_lesson_content")
    .upsert(row, { onConflict: "course_id,lesson_id" });
  if (error) throw new Error(error.message);

  console.log(`[cap-update] linked lesson ${LESSON_ID}`);
  console.log(`[cap-update] videoUrl=${videoUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

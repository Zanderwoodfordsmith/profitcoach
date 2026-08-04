/**
 * Upload Progress Method Client Retention videos + audiobook MP3s and set
 * academy_lesson_content.video_url / audio_url for Coach Clients → Client Retention.
 *
 * Usage:
 *   npx tsx scripts/import-client-retention-progress-method.ts --dry-run
 *   npx tsx scripts/import-client-retention-progress-method.ts --apply
 *   npx tsx scripts/import-client-retention-progress-method.ts --apply --skip-videos
 *   npx tsx scripts/import-client-retention-progress-method.ts --apply --skip-audio
 *   npx tsx scripts/import-client-retention-progress-method.ts --apply --duration-only
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { probeLessonDurationLabel } from "./lib/probeMediaDuration";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_AUDIO_DIR =
  "/Users/zander/Library/CloudStorage/GoogleDrive-zander@businesscoachacademy.com/Shared drives/Business Coach Academy/Z. BCA archive (Apr 2026) All Old Files/z. archive/Delivery Archive/Profit Coach Audio Book/Progress Method Coaching Clients";

const DEFAULT_VIDEO_DIR =
  "/Users/zander/Library/CloudStorage/GoogleDrive-zander@businesscoachacademy.com/Shared drives/Business Coach Academy/Z. BCA archive (Apr 2026) All Old Files/3. Product/1. Product Content/Old Academy/9. Income Escalation/Progress Method - Videos";

const COURSE_ID = "profit-coach-system";

const LESSONS: ReadonlyArray<{
  lessonId: string;
  title: string;
  audioFileName: string;
  videoFileName: string | null;
}> = [
  {
    lessonId: "client-retention-prevent-overwhelm",
    title: "Prevent Overwhelm",
    audioFileName: "10-01 9.1 Prevent Overwhelm.mp3",
    videoFileName: "M2.1 L2 Prevent Overwhelm.mp4",
  },
  {
    lessonId: "client-retention-remove-distraction",
    title: "Remove Distraction",
    audioFileName: "10-02 9.2 Remove distraction.mp3",
    videoFileName: "M2.2 L3 Remove distraction.mp4",
  },
  {
    lessonId: "client-retention-ownership",
    title: "Ownership",
    audioFileName: "10-03 9.3 Ownership.mp3",
    videoFileName: "M2.3 L4 Ownership.mp4",
  },
  {
    lessonId: "client-retention-generate-belief",
    title: "Generate Belief",
    audioFileName: "10-04 9.4 Generate belief.mp3",
    videoFileName: "M2.4 L5 Generate belief.mp4",
  },
  {
    lessonId: "client-retention-results-and-rewards",
    title: "Results and Rewards",
    audioFileName: "10-05 9.5 Results and rewards.mp3",
    videoFileName: "M2.5 L6 Results and rewards.mp4",
  },
  {
    lessonId: "client-retention-exemplify",
    title: "Exemplify",
    audioFileName: "10-06 9.6 Exemplify.mp3",
    videoFileName: "M2.1 L7 Exemplify.mp4",
  },
  {
    lessonId: "client-retention-sustainability",
    title: "Sustainability",
    audioFileName: "10-07 9.7 Sustainability.mp3",
    videoFileName: "M2.7 Sustainability.mp4",
  },
  {
    lessonId: "client-retention-self-identity",
    title: "Self-Identity",
    audioFileName: "10-08 9.8 Self-Identity.mp3",
    videoFileName: "M2.8 Self-Identity.mp4",
  },
];

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const apply = argv.includes("--apply");
const skipVideos = argv.includes("--skip-videos");
const skipAudio = argv.includes("--skip-audio");
/** Probe + write duration only (no storage re-upload). */
const durationOnly = argv.includes("--duration-only");

const audioDirIdx = argv.indexOf("--audio-dir");
const audioDir =
  audioDirIdx >= 0 && argv[audioDirIdx + 1]
    ? path.resolve(argv[audioDirIdx + 1]!)
    : DEFAULT_AUDIO_DIR;

const videoDirIdx = argv.indexOf("--video-dir");
const videoDir =
  videoDirIdx >= 0 && argv[videoDirIdx + 1]
    ? path.resolve(argv[videoDirIdx + 1]!)
    : DEFAULT_VIDEO_DIR;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!dryRun && !apply) {
  console.error("Pass --dry-run or --apply.");
  process.exit(1);
}

function publicUrl(storagePath: string): string {
  return `${SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/object/public/academy-lessons/${storagePath}`;
}

function mb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[client-retention] audioDir=${audioDir}`);
  console.log(`[client-retention] videoDir=${videoDir}`);
  console.log(
    `[client-retention] mode=${apply ? "apply" : "dry-run"} skipVideos=${skipVideos} skipAudio=${skipAudio} durationOnly=${durationOnly}`
  );

  type Planned = {
    lessonId: string;
    title: string;
    audioPath: string | null;
    videoPath: string | null;
    audioStoragePath: string | null;
    videoStoragePath: string | null;
    audioUrl: string | null;
    videoUrl: string | null;
    audioMb: number | null;
    videoMb: number | null;
    duration: string | null;
  };

  const planned: Planned[] = [];

  for (const lesson of LESSONS) {
    const audioPath = skipAudio
      ? null
      : path.join(audioDir, lesson.audioFileName);
    const videoPath =
      skipVideos || !lesson.videoFileName
        ? null
        : path.join(videoDir, lesson.videoFileName);

    if (audioPath && !fs.existsSync(audioPath)) {
      console.error(`[client-retention] missing audio: ${audioPath}`);
      process.exit(1);
    }
    if (videoPath && !fs.existsSync(videoPath)) {
      console.error(`[client-retention] missing video: ${videoPath}`);
      process.exit(1);
    }

    const audioStoragePath = audioPath
      ? `${COURSE_ID}/${lesson.lessonId}/audio.mp3`
      : null;
    const videoStoragePath = videoPath
      ? `${COURSE_ID}/${lesson.lessonId}/source.mp4`
      : null;

    const audioMb = audioPath ? mb(fs.statSync(audioPath).size) : null;
    const videoMb = videoPath ? mb(fs.statSync(videoPath).size) : null;

    if (videoPath) {
      const size = fs.statSync(videoPath).size;
      if (size > MAX_VIDEO_BYTES) {
        console.error(
          `[client-retention] video too large for ${lesson.lessonId}: ${mb(size)}MB`
        );
        process.exit(1);
      }
    }

    const duration = await probeLessonDurationLabel({ videoPath, audioPath });

    planned.push({
      lessonId: lesson.lessonId,
      title: lesson.title,
      audioPath,
      videoPath,
      audioStoragePath,
      videoStoragePath,
      audioUrl: audioStoragePath ? publicUrl(audioStoragePath) : null,
      videoUrl: videoStoragePath ? publicUrl(videoStoragePath) : null,
      audioMb,
      videoMb,
      duration,
    });

    console.log(
      `[client-retention] ${lesson.lessonId}` +
        (audioMb != null ? ` audio=${audioMb}MB` : "") +
        (videoMb != null ? ` video=${videoMb}MB` : "") +
        (duration ? ` duration=${duration}` : " duration=?")
    );
  }

  if (!apply) {
    console.log(`[client-retention] done (${planned.length} lessons)`);
    return;
  }

  if (!durationOnly) {
    for (const item of planned) {
      if (item.audioPath && item.audioStoragePath) {
        const buf = fs.readFileSync(item.audioPath);
        const { error } = await supabase.storage
          .from("academy-lessons")
          .upload(item.audioStoragePath, buf, {
            contentType: "audio/mpeg",
            upsert: true,
          });
        if (error) {
          throw new Error(`${item.lessonId} audio upload: ${error.message}`);
        }
        console.log(`[client-retention] uploaded ${item.audioStoragePath}`);
      }

      if (item.videoPath && item.videoStoragePath) {
        console.log(
          `[client-retention] uploading video ${item.lessonId} (${item.videoMb}MB)…`
        );
        const buf = fs.readFileSync(item.videoPath);
        const { error } = await supabase.storage
          .from("academy-lessons")
          .upload(item.videoStoragePath, buf, {
            contentType: "video/mp4",
            upsert: true,
          });
        if (error) {
          throw new Error(`${item.lessonId} video upload: ${error.message}`);
        }
        console.log(`[client-retention] uploaded ${item.videoStoragePath}`);
      }
    }
  }

  for (const item of planned) {
    const { data: existing, error: readError } = await supabase
      .from("academy_lesson_content")
      .select("*")
      .eq("course_id", COURSE_ID)
      .eq("lesson_id", item.lessonId)
      .maybeSingle();
    if (readError) {
      throw new Error(`${item.lessonId} read: ${readError.message}`);
    }

    const bodyMarkdown =
      existing?.body_markdown ??
      `## Progress Method — ${item.title}\n\nThis lesson is part of the Progress Method for keeping clients engaged, making measurable progress, and staying on the coaching journey.\n\nWatch the video or listen to the audio, then apply the idea in your next client session.`;

    const row = {
      course_id: COURSE_ID,
      lesson_id: item.lessonId,
      title: existing?.title ?? item.title,
      video_url: durationOnly
        ? (existing?.video_url ?? null)
        : (item.videoUrl ?? existing?.video_url ?? null),
      audio_url: durationOnly
        ? (existing?.audio_url ?? null)
        : (item.audioUrl ?? existing?.audio_url ?? null),
      body_markdown: bodyMarkdown,
      guide_markdown: existing?.guide_markdown ?? null,
      transcript_text: existing?.transcript_text ?? null,
      duration: item.duration ?? existing?.duration ?? null,
      recommended_actions: existing?.recommended_actions ?? [],
      is_draft: existing?.is_draft ?? false,
      is_deleted: existing?.is_deleted ?? false,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("academy_lesson_content")
      .upsert(row, { onConflict: "course_id,lesson_id" });
    if (upsertError) {
      throw new Error(`${item.lessonId} upsert: ${upsertError.message}`);
    }
    console.log(
      `[client-retention] saved ${durationOnly ? "duration" : "content"} for ${item.lessonId}` +
        (item.duration ? ` (${item.duration})` : "")
    );
  }

  console.log(`[client-retention] done (${planned.length} lessons)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

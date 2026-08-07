/**
 * Upload Going Pro Day Zero PRO lesson MP3s from the BCA shared Drive archive
 * and set academy_lesson_content.audio_url.
 *
 * Usage:
 *   npx tsx scripts/import-going-pro-day-zero-audio.ts --dry-run
 *   npx tsx scripts/import-going-pro-day-zero-audio.ts --apply
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
  "/Users/zander/Library/CloudStorage/GoogleDrive-zander@businesscoachacademy.com/Shared drives/Business Coach Academy/Z. BCA archive (Apr 2026) All Old Files/z. archive/Delivery Archive/Profit Coach Audio Book/0 | P.R.O.F.I.T. Coach Audiobook Day Zero- Going Pro";

const COURSE_ID = "going-pro";

const LESSONS: ReadonlyArray<{
  lessonId: string;
  fileName: string;
}> = [
  {
    lessonId: "going-pro-iii-1-day-zero-pro-energy",
    fileName: "1-06 0.5 Pro Energy.mp3",
  },
  {
    lessonId: "going-pro-iii-1-day-zero-pro-time-management",
    fileName: "1-07 0.6 Pro Time-Management.mp3",
  },
  {
    lessonId: "going-pro-iii-1-day-zero-pro-focus",
    fileName: "1-08 0.7 Pro Focus.mp3",
  },
  {
    lessonId: "going-pro-iii-1-day-zero-pro-productivity",
    fileName: "1-09 0.8 Pro Productivity.mp3",
  },
  {
    lessonId: "going-pro-iii-1-day-zero-pro-mindset",
    fileName: "Pro Mindset.mp3",
  },
];

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const apply = argv.includes("--apply");

const dirIdx = argv.indexOf("--dir");
const audioDir =
  dirIdx >= 0 && argv[dirIdx + 1]
    ? path.resolve(argv[dirIdx + 1]!)
    : DEFAULT_AUDIO_DIR;

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

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[going-pro-audio] dir=${audioDir}`);
  console.log(`[going-pro-audio] mode=${apply ? "apply" : "dry-run"}`);

  const planned: Array<{
    lessonId: string;
    fileName: string;
    filePath: string;
    storagePath: string;
    url: string;
    sizeMb: number;
    duration: string | null;
  }> = [];

  for (const lesson of LESSONS) {
    const filePath = path.join(audioDir, lesson.fileName);
    if (!fs.existsSync(filePath)) {
      console.error(`[going-pro-audio] missing file: ${filePath}`);
      process.exit(1);
    }
    const sizeMb = Math.round((fs.statSync(filePath).size / (1024 * 1024)) * 10) / 10;
    const storagePath = `${COURSE_ID}/${lesson.lessonId}/audio.mp3`;
    const url = publicUrl(storagePath);
    const duration = await probeLessonDurationLabel({ audioPath: filePath });
    planned.push({
      lessonId: lesson.lessonId,
      fileName: lesson.fileName,
      filePath,
      storagePath,
      url,
      sizeMb,
      duration,
    });
    console.log(
      `[going-pro-audio] ${lesson.lessonId} ← ${lesson.fileName} (${sizeMb}MB)` +
        (duration ? ` duration=${duration}` : " duration=?") +
        ` → ${storagePath}`
    );
  }

  if (!apply) {
    console.log(`[going-pro-audio] done (${planned.length} lessons)`);
    return;
  }

  for (const item of planned) {
    const buf = fs.readFileSync(item.filePath);
    const { error: uploadError } = await supabase.storage
      .from("academy-lessons")
      .upload(item.storagePath, buf, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (uploadError) {
      throw new Error(`${item.lessonId} upload: ${uploadError.message}`);
    }
    console.log(`[going-pro-audio] uploaded ${item.storagePath}`);
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

    const row = {
      course_id: COURSE_ID,
      lesson_id: item.lessonId,
      title: existing?.title ?? null,
      video_url: existing?.video_url ?? null,
      audio_url: item.url,
      body_markdown: existing?.body_markdown ?? null,
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
    console.log(`[going-pro-audio] saved audio_url for ${item.lessonId}`);
  }

  console.log(`[going-pro-audio] done (${planned.length} lessons)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * Import the two missing Launch Your Connector Campaign chapter videos
 * from Old Academy Drive.
 *
 * Usage:
 *   npx tsx scripts/import-connector-campaign-videos.ts
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { stripTranscriptSpeakerLabels } from "../src/lib/academy/stripTranscriptSpeakerLabels";
import { deleteUnmatchedImportFile } from "../src/lib/academy/academyImportSnapshot";
import { probeLessonDurationLabel } from "./lib/probeMediaDuration";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const OLD_ACADEMY = path.join(
  process.env.HOME ?? "",
  "Library/CloudStorage/GoogleDrive-zander@businesscoachacademy.com/Shared drives/Business Coach Academy/3. Product/Old Academy",
);

const COURSE_ID = "get-calls";

const ITEMS = [
  {
    lessonId:
      "get-calls-lead-generation-ai-automation-how-to-create-campaigns-in-connect-ai",
    title: "How to Create Campaigns in Connect Ai",
    videoPath: path.join(
      OLD_ACADEMY,
      "Videos/5. Client Aquisition/2. Lead Generation - AI Automation/How_to_Create_Campaigns_958401a5-d7d7-43e0-b4c3-08611e3d0d84.mp4",
    ),
    transcriptPath: path.join(
      OLD_ACADEMY,
      "Transcripts/5. Client Aquisition/2. Lead Generation - AI Automation/How_to_Create_Campaigns_958401a5_d7d7_43e0_b4c3_08611e3d0d84.txt",
    ),
    unmatchedRelativePath:
      "5. Client Aquisition/2. Lead Generation - AI Automation/How_to_Create_Campaigns_958401a5_d7d7_43e0_b4c3_08611e3d0d84.txt",
  },
  {
    lessonId:
      "get-calls-lead-generation-ai-automation-how-to-create-a-campaign-for-prospects-you-are-already-connected-with",
    title: "How to Create a Campaign for Prospects you are Already Connected With",
    videoPath: path.join(
      OLD_ACADEMY,
      "Videos/5. Client Aquisition/2. Lead Generation - AI Automation/Creating_a_LinkedIn_Campaign_with_First_Degree_Connections_bc7a183f-9100-4ea9-80b4-0798226537f5.mp4",
    ),
    transcriptPath: path.join(
      OLD_ACADEMY,
      "Transcripts/5. Client Aquisition/2. Lead Generation - AI Automation/Creating_a_LinkedIn_Campaign_with_First_Degree_Connections_bc7a183f_9100_4ea9_80b4_0798226537f5.txt",
    ),
    unmatchedRelativePath:
      "5. Client Aquisition/2. Lead Generation - AI Automation/Creating_a_LinkedIn_Campaign_with_First_Degree_Connections_bc7a183f_9100_4ea9_80b4_0798226537f5.txt",
  },
] as const;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function publicUrl(storagePath: string): string {
  return `${SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/object/public/academy-lessons/${storagePath}`;
}

async function uploadVideo(lessonId: string, filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase().replace(".", "") || "mp4";
  const storagePath = `${COURSE_ID}/${lessonId}/source.${ext}`;
  const sizeMb = Math.round((fs.statSync(filePath).size / (1024 * 1024)) * 10) / 10;
  console.log(`Uploading ${lessonId} (${sizeMb} MB) → ${storagePath}`);
  const buf = fs.readFileSync(filePath);
  const { error } = await supabase.storage.from("academy-lessons").upload(storagePath, buf, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return publicUrl(storagePath);
}

async function upsertLesson(input: {
  lessonId: string;
  title: string;
  videoUrl: string;
  transcriptText: string;
  duration: string | null;
}) {
  const { data: existing } = await supabase
    .from("academy_lesson_content")
    .select("*")
    .eq("course_id", COURSE_ID)
    .eq("lesson_id", input.lessonId)
    .maybeSingle();

  const row = {
    course_id: COURSE_ID,
    lesson_id: input.lessonId,
    title: existing?.title ?? input.title,
    video_url: input.videoUrl,
    body_markdown: existing?.body_markdown ?? null,
    guide_markdown: existing?.guide_markdown ?? null,
    transcript_text: input.transcriptText,
    duration: input.duration ?? existing?.duration ?? null,
    recommended_actions: existing?.recommended_actions ?? [],
    is_draft: existing?.is_draft ?? false,
    is_deleted: existing?.is_deleted ?? false,
    video_chapters: existing?.video_chapters ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("academy_lesson_content")
    .upsert(row, { onConflict: "course_id,lesson_id" });
  if (error) throw new Error(error.message);
}

async function main() {
  for (const item of ITEMS) {
    if (!fs.existsSync(item.videoPath)) {
      throw new Error(`Missing video: ${item.videoPath}`);
    }
    if (!fs.existsSync(item.transcriptPath)) {
      throw new Error(`Missing transcript: ${item.transcriptPath}`);
    }

    const videoUrl = await uploadVideo(item.lessonId, item.videoPath);
    const rawTranscript = fs.readFileSync(item.transcriptPath, "utf8");
    const transcriptText = stripTranscriptSpeakerLabels(rawTranscript).trim();
    const duration = await probeLessonDurationLabel({ videoPath: item.videoPath });

    await upsertLesson({
      lessonId: item.lessonId,
      title: item.title,
      videoUrl,
      transcriptText,
      duration,
    });
    console.log(`Saved ${item.lessonId} duration=${duration ?? "n/a"} transcriptChars=${transcriptText.length}`);

    try {
      const removed = await deleteUnmatchedImportFile(item.unmatchedRelativePath);
      console.log(`Cleared unmatched: ${removed.relativePath} disk=${removed.deletedFromDisk}`);
    } catch (error) {
      console.warn(
        `Could not clear unmatched ${item.unmatchedRelativePath}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Refresh parent duration from chapter durations when possible.
  const parentId = "get-calls-lead-generation-get-started-with-connector";
  const { data: parent } = await supabase
    .from("academy_lesson_content")
    .select("video_chapters, duration")
    .eq("course_id", COURSE_ID)
    .eq("lesson_id", parentId)
    .maybeSingle();
  if (parent?.video_chapters) {
    const chapterIds = (parent.video_chapters as Array<{ source_lesson_id?: string }>)
      .map((c) => c.source_lesson_id)
      .filter((id): id is string => Boolean(id));
    const { data: chapters } = await supabase
      .from("academy_lesson_content")
      .select("lesson_id, duration, video_url")
      .in("lesson_id", chapterIds);
    console.log(
      JSON.stringify(
        {
          parentId,
          chapters: (chapters ?? []).map((c) => ({
            id: c.lesson_id,
            duration: c.duration,
            hasVideo: Boolean(c.video_url),
          })),
        },
        null,
        2,
      ),
    );
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

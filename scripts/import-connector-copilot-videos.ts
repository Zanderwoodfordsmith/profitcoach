/**
 * Import Set Up Connector Co-Pilot chapter videos from Old Academy Drive.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-connector-copilot-videos.ts
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { stripTranscriptSpeakerLabels } from "../src/lib/academy/stripTranscriptSpeakerLabels";
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
const PARENT_ID = "get-calls-replying-to-leads-set-up-connector-co-pilot";
const REPLYING = "5. Client Aquisition/3. Replying to Leads";

const ITEMS = [
  {
    chapterId: "setup",
    lessonId: "get-calls-replying-to-leads-how-to-set-up-connector-ai-co-pilot",
    title: "How to Set Up Connector Ai Co-Pilot",
    videoPath: path.join(
      OLD_ACADEMY,
      "Videos",
      REPLYING,
      "Setting_Up_Client_Connect_AI_for_Effective_Communication_98864445-3946-4111-93db-871bd38db467.mp4",
    ),
    transcriptPath: path.join(
      OLD_ACADEMY,
      "Transcripts",
      REPLYING,
      "Setting_Up_Client_Connect_AI_for_Effective_Communication_98864445_3946_4111_93db_871bd38db467.txt",
    ),
    unmatchedRelativePath: `${REPLYING}/Setting_Up_Client_Connect_AI_for_Effective_Communication_98864445_3946_4111_93db_871bd38db467.txt`,
  },
  {
    chapterId: "mode",
    lessonId: "get-calls-replying-to-leads-choosing-between-ai-co-pilot-auto-pilot",
    title: "Choosing between Ai Co-Pilot & Auto-Pilot",
    videoPath: path.join(
      OLD_ACADEMY,
      "Videos",
      REPLYING,
      "Choosing_Between_AI_Auto_and_Co-Pilot_for_Your_Campaigns____ca4ab18e-8454-4672-887f-a3838fa8d2dc.mp4",
    ),
    transcriptPath: path.join(
      OLD_ACADEMY,
      "Transcripts",
      REPLYING,
      "Choosing_Between_AI_Auto_and_Co_Pilot_for_Your_Campaigns_ca4ab18e_8454_4672_887f_a3838fa8d2dc.txt",
    ),
    unmatchedRelativePath: `${REPLYING}/Choosing_Between_AI_Auto_and_Co_Pilot_for_Your_Campaigns_ca4ab18e_8454_4672_887f_a3838fa8d2dc.txt`,
  },
  {
    chapterId: "activate",
    lessonId: "get-calls-replying-to-leads-how-to-activate-the-ai-and-test",
    title: "How to Activate The Ai and Test",
    videoPath: path.join(
      OLD_ACADEMY,
      "Videos",
      REPLYING,
      "Configuring_and_Testing_Your_SOP_for_AI_Success____a7f2dae4-de09-4efc-a2bd-3f0f59e9f5b9.mp4",
    ),
    transcriptPath: path.join(
      OLD_ACADEMY,
      "Transcripts",
      REPLYING,
      "Configuring_and_Testing_Your_SOP_for_AI_Success_a7f2dae4_de09_4efc_a2bd_3f0f59e9f5b9.txt",
    ),
    unmatchedRelativePath: `${REPLYING}/Configuring_and_Testing_Your_SOP_for_AI_Success_a7f2dae4_de09_4efc_a2bd_3f0f59e9f5b9.txt`,
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
  const durations: Record<string, string> = {};

  for (const item of ITEMS) {
    if (!fs.existsSync(item.videoPath)) throw new Error(`Missing video: ${item.videoPath}`);
    if (!fs.existsSync(item.transcriptPath)) {
      throw new Error(`Missing transcript: ${item.transcriptPath}`);
    }

    const videoUrl = await uploadVideo(item.lessonId, item.videoPath);
    const transcriptText = stripTranscriptSpeakerLabels(
      fs.readFileSync(item.transcriptPath, "utf8"),
    ).trim();
    const duration = await probeLessonDurationLabel({ videoPath: item.videoPath });
    if (duration) durations[item.lessonId] = duration;

    await upsertLesson({
      lessonId: item.lessonId,
      title: item.title,
      videoUrl,
      transcriptText,
      duration,
    });
    console.log(
      `Saved ${item.lessonId} duration=${duration ?? "n/a"} transcriptChars=${transcriptText.length}`,
    );
  }

  const { data: parent, error: parentError } = await supabase
    .from("academy_lesson_content")
    .select("video_chapters")
    .eq("course_id", COURSE_ID)
    .eq("lesson_id", PARENT_ID)
    .single();
  if (parentError) throw new Error(parentError.message);

  const chapters = ((parent.video_chapters as Array<Record<string, unknown>>) ?? []).map(
    (chapter) => {
      const sourceId =
        typeof chapter.source_lesson_id === "string" ? chapter.source_lesson_id : "";
      return {
        ...chapter,
        duration: durations[sourceId] ?? chapter.duration ?? null,
      };
    },
  );
  const totalMinutes = chapters.reduce((sum, chapter) => {
    const match = String(chapter.duration || "").match(/(\d+)\s*m/);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);

  const { error: updateError } = await supabase
    .from("academy_lesson_content")
    .update({
      video_chapters: chapters,
      duration: totalMinutes > 0 ? `${totalMinutes}m` : null,
      updated_at: new Date().toISOString(),
    })
    .eq("course_id", COURSE_ID)
    .eq("lesson_id", PARENT_ID);
  if (updateError) throw new Error(updateError.message);

  const { deleteUnmatchedImportFile } = await import("../src/lib/academy/academyImportSnapshot");
  for (const item of ITEMS) {
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

  console.log(JSON.stringify({ chapters, parentDuration: `${totalMinutes}m` }, null, 2));
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

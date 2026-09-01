/**
 * Import Connector add-ons from Old Academy Drive:
 * - Download Sales Navigator Profiles to CSV (Related satellite)
 * - How to Add More Prospects to a Connector Campaign (last main chapter)
 *
 * Usage:
 *   npx tsx scripts/import-connector-addon-videos.ts
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
const PARENT_ID = "get-calls-lead-generation-get-started-with-connector";

const ITEMS = [
  {
    lessonId:
      "get-calls-lead-generation-ai-automation-how-to-export-a-sales-nav-list-to-csv",
    title: "Download Sales Navigator Profiles to CSV",
    role: "satellite" as const,
    videoPath: path.join(
      OLD_ACADEMY,
      "Videos/5. Client Aquisition/2. Lead Generation - AI Automation/Download_Sales_Navigator_Profiles_to_CSV_a8dd3f32-a6dd-47ec-98e8-48d01bea55b1.mp4",
    ),
    transcriptPath: path.join(
      OLD_ACADEMY,
      "Transcripts/5. Client Aquisition/2. Lead Generation - AI Automation/Download_Sales_Navigator_Profiles_to_CSV_a8dd3f32_a6dd_47ec_98e8_48d01bea55b1.txt",
    ),
    unmatchedRelativePath:
      "5. Client Aquisition/2. Lead Generation - AI Automation/Download_Sales_Navigator_Profiles_to_CSV_a8dd3f32_a6dd_47ec_98e8_48d01bea55b1.txt",
  },
  {
    lessonId: "get-calls-faq-how-to-add-more-prospects-to-a-connector-campaign",
    title: "How to Add More Prospects to a Connector Campaign",
    role: "chapter" as const,
    chapterId: "add-prospects",
    videoPath: path.join(
      OLD_ACADEMY,
      "Videos/5. Client Aquisition/5. Sales Pitch/How_to_Add_More_Prospects_to_a_Connector_Cmaping_b976d319-a939-40ee-a250-d3459db2ae0c.mp4",
    ),
    transcriptPath: path.join(
      OLD_ACADEMY,
      "Transcripts/5. Client Aquisition/5. Sales Pitch/How_to_Add_More_Prospects_to_a_Connector_Cmaping_b976d319_a939_40ee_a250_d3459db2ae0c.txt",
    ),
    unmatchedRelativePath:
      "5. Client Aquisition/5. Sales Pitch/How_to_Add_More_Prospects_to_a_Connector_Cmaping_b976d319_a939_40ee_a250_d3459db2ae0c.txt",
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
    title: input.title,
    video_url: input.videoUrl,
    body_markdown: existing?.body_markdown ?? null,
    guide_markdown: existing?.guide_markdown ?? null,
    transcript_text: input.transcriptText,
    duration: input.duration ?? existing?.duration ?? null,
    recommended_actions: existing?.recommended_actions ?? [],
    is_draft: false,
    is_deleted: false,
    video_chapters: existing?.video_chapters ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("academy_lesson_content")
    .upsert(row, { onConflict: "course_id,lesson_id" });
  if (error) throw new Error(error.message);
}

async function main() {
  const imported: Array<{
    lessonId: string;
    title: string;
    role: "satellite" | "chapter";
    chapterId?: string;
    duration: string | null;
  }> = [];

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
    console.log(
      `Saved ${item.lessonId} role=${item.role} duration=${duration ?? "n/a"} transcriptChars=${transcriptText.length}`,
    );

    imported.push({
      lessonId: item.lessonId,
      title: item.title,
      role: item.role,
      chapterId: "chapterId" in item ? item.chapterId : undefined,
      duration,
    });

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

  const chapter = imported.find((row) => row.role === "chapter");
  if (chapter?.chapterId) {
    const { data: parent } = await supabase
      .from("academy_lesson_content")
      .select("video_chapters, duration")
      .eq("course_id", COURSE_ID)
      .eq("lesson_id", PARENT_ID)
      .maybeSingle();

    type ChapterRow = {
      id: string;
      title: string;
      duration?: string | null;
      source_lesson_id?: string | null;
      optional?: boolean | null;
      video_url?: string | null;
    };

    const chapters = Array.isArray(parent?.video_chapters)
      ? ([...parent.video_chapters] as ChapterRow[])
      : [];
    const existingIdx = chapters.findIndex(
      (row) =>
        row.id === chapter.chapterId || row.source_lesson_id === chapter.lessonId,
    );
    const nextChapter: ChapterRow = {
      id: chapter.chapterId,
      title: chapter.title,
      duration: chapter.duration,
      source_lesson_id: chapter.lessonId,
    };
    if (existingIdx >= 0) chapters[existingIdx] = nextChapter;
    else chapters.push(nextChapter);

    const { error } = await supabase
      .from("academy_lesson_content")
      .update({
        video_chapters: chapters,
        updated_at: new Date().toISOString(),
      })
      .eq("course_id", COURSE_ID)
      .eq("lesson_id", PARENT_ID);
    if (error) throw new Error(error.message);
    console.log(`Parent chapters now ${chapters.length} (added/updated ${chapter.chapterId})`);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

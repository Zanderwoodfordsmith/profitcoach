/**
 * Merge Going Pro "Pro Business" lessons into one archive lesson
 * (Business Setup and Essentials) with stacked guides, then soft-delete
 * the four source lessons.
 *
 * Usage:
 *   npx tsx scripts/merge-pro-business-into-archive.ts --dry-run
 *   npx tsx scripts/merge-pro-business-into-archive.ts --apply
 */

import { readFileSync } from "fs";
import { join } from "path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { normalizeLessonMarkdown } from "../src/lib/academy/normalizeLessonMarkdown";

loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COURSE_ID = "going-pro";
const MERGED_LESSON_ID =
  "going-pro-iii-2-pro-business-business-setup-and-essentials";
const MERGED_TITLE = "Business Setup and Essentials";

const SOURCE_LESSONS: ReadonlyArray<{ id: string; title: string }> = [
  {
    id: "going-pro-iii-2-pro-business-selecting-the-right-business-structure",
    title: "Selecting the Right Business Structure",
  },
  {
    id: "going-pro-iii-2-pro-business-setting-up-a-business-bank-account",
    title: "Setting Up a Business Bank Account",
  },
  {
    id: "going-pro-iii-2-pro-business-securing-business-insurance",
    title: "Securing Business Insurance",
  },
  {
    id: "going-pro-iii-2-pro-business-understand-tax-implications",
    title: "Understand Tax Implications",
  },
];

type ContentRow = {
  course_id: string;
  lesson_id: string;
  title: string | null;
  video_url: string | null;
  body_markdown: string | null;
  guide_markdown: string | null;
  transcript_text: string | null;
};

/** Demote top-level # / ## so lesson-name ## headers stay the outline. */
function demoteGuideHeadings(markdown: string): string {
  return markdown
    .replace(/^### /gm, "#### ")
    .replace(/^## /gm, "### ")
    .replace(/^# /gm, "### ");
}

function stripLeadingTitleHeading(markdown: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown
    .replace(new RegExp(`^#+\\s*\\*?\\*?${escaped}\\*?\\*?\\s*\\n+`, "i"), "")
    .trim();
}

function loadBackupRows(): Map<string, ContentRow> {
  const path = join(
    process.cwd(),
    "scripts/backups/academy-lesson-guide-split-2026-07-31T14-54-22-948Z.json",
  );
  const rows = JSON.parse(readFileSync(path, "utf8")) as ContentRow[];
  return new Map(rows.map((row) => [row.lesson_id, row]));
}

function buildMergedGuide(
  rows: Map<string, ContentRow>,
): { guide: string; body: string; videoUrl: string | null } {
  const parts: string[] = [];
  let videoUrl: string | null = null;

  for (const source of SOURCE_LESSONS) {
    const row = rows.get(source.id);
    if (!row) {
      throw new Error(`Missing content for ${source.id}`);
    }
    if (!videoUrl && row.video_url?.trim()) {
      videoUrl = row.video_url.trim();
    }

    const rawGuide = (row.guide_markdown ?? "").trim();
    const fallbackBody = (row.body_markdown ?? "").trim();
    const sourceMarkdown = rawGuide || fallbackBody;
    if (!sourceMarkdown) {
      throw new Error(`Empty guide/body for ${source.id}`);
    }

    const cleaned = demoteGuideHeadings(
      stripLeadingTitleHeading(sourceMarkdown, source.title),
    );
    parts.push(`## ${source.title}\n\n${cleaned}`);
  }

  const guide = normalizeLessonMarkdown(parts.join("\n\n"));
  const body = normalizeLessonMarkdown(
    [
      "The essentials of setting up your coaching business: structure, banking, insurance, and tax.",
      "",
      "**In this guide**",
      "",
      ...SOURCE_LESSONS.map((lesson) => `- ${lesson.title}`),
    ].join("\n"),
  );

  return { guide, body, videoUrl };
}

async function main() {
  const sourceIds = SOURCE_LESSONS.map((lesson) => lesson.id);
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select(
      "course_id, lesson_id, title, video_url, body_markdown, guide_markdown, transcript_text",
    )
    .eq("course_id", COURSE_ID)
    .in("lesson_id", sourceIds);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const fromDb = new Map((data ?? []).map((row) => [row.lesson_id, row as ContentRow]));
  const fromBackup = loadBackupRows();
  const rows = new Map<string, ContentRow>();

  for (const source of SOURCE_LESSONS) {
    const dbRow = fromDb.get(source.id);
    const backupRow = fromBackup.get(source.id);
    const preferred = dbRow?.guide_markdown?.trim()
      ? dbRow
      : backupRow?.guide_markdown?.trim()
        ? { ...backupRow, ...dbRow, guide_markdown: backupRow.guide_markdown }
        : dbRow ?? backupRow;
    if (!preferred) {
      throw new Error(`No DB or backup row for ${source.id}`);
    }
    rows.set(source.id, preferred);
  }

  const { guide, body, videoUrl } = buildMergedGuide(rows);

  console.log(`Sources found: ${rows.size}/${SOURCE_LESSONS.length}`);
  console.log(`Merged guide chars: ${guide.length}`);
  console.log(`Merged body chars: ${body.length}`);
  console.log(`Video url kept: ${videoUrl ? "yes (first available)" : "none"}`);
  console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);

  if (!apply) {
    console.log("Re-run with --apply to write.");
    return;
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await supabase.from("academy_lesson_content").upsert(
    {
      course_id: COURSE_ID,
      lesson_id: MERGED_LESSON_ID,
      title: MERGED_TITLE,
      video_url: videoUrl,
      body_markdown: body,
      guide_markdown: guide,
      is_draft: false,
      is_deleted: false,
      updated_at: now,
    },
    { onConflict: "course_id,lesson_id" },
  );

  if (upsertError) {
    console.error("Upsert failed:", upsertError.message);
    process.exit(1);
  }

  const { error: deleteError } = await supabase
    .from("academy_lesson_content")
    .update({ is_deleted: true, updated_at: now })
    .eq("course_id", COURSE_ID)
    .in("lesson_id", sourceIds);

  if (deleteError) {
    console.error("Soft-delete failed:", deleteError.message);
    process.exit(1);
  }

  console.log(`Upserted ${MERGED_LESSON_ID}`);
  console.log(`Soft-deleted ${sourceIds.length} source lessons`);
}

void main();

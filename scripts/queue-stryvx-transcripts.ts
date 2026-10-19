/**
 * Queue Happy Scribe timed transcripts for StryvX (Vault), in course order,
 * up to a monthly hour budget (Happy Scribe includes 10 hours a month).
 *
 * Picks lessons that have a video and either no transcript or an old untimed
 * one (from scripts/import-stryvx-vault.ts --transcripts). Untimed transcripts
 * are cleared only for the lessons queued, right before the batch, so the
 * Happy Scribe result can land. The production cron (/api/cron/happy-scribe)
 * submits and imports the jobs.
 *
 * Run it again next month to carry on where this month stopped.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/queue-stryvx-transcripts.ts --dry-run
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/queue-stryvx-transcripts.ts --hours 9.5
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const COURSE_ID = "stryvx";
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const hoursIdx = argv.indexOf("--hours");
// Under 10 so per-file rounding on Happy Scribe's side stays inside the allowance.
const budgetHours = hoursIdx >= 0 ? Number(argv[hoursIdx + 1]) : 9.5;

/** Happy Scribe output: one `[hh:mm:ss] text` cue per paragraph. */
function isTimedTranscript(text: string): boolean {
  const first = text.split("\n").find((line) => line.trim());
  return Boolean(first && /^\s*\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(first));
}

async function main() {
  if (!Number.isFinite(budgetHours) || budgetHours <= 0) throw new Error("--hours must be a positive number");

  const { durationLabelToSeconds } = await import("../src/lib/happyScribe/candidates");
  const { createTranscriptionBatch } = await import("../src/lib/happyScribe/queue");
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  type HubCatalog = import("../src/lib/academy/hubCatalog").HubCatalog;

  const catalog = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content/academy/vault-hub.json"), "utf8"),
  ) as HubCatalog;
  const course = catalog.courses.find((c) => c.id === COURSE_ID);
  if (!course) throw new Error(`vault-hub.json has no ${COURSE_ID} course`);
  // Transcripts belong to each video, so merged lessons expand to their chapter sources.
  type ChapterSource = { title: string; sourceLessonId: string; duration: string };
  const lessons = course.sections.flatMap((section) =>
    section.lessons.flatMap((lesson) => {
      const chapters = (lesson as { chapterSources?: ChapterSource[] }).chapterSources;
      return chapters?.length
        ? chapters.map((c) => ({ id: c.sourceLessonId, title: c.title, duration: c.duration }))
        : [{ id: lesson.id, title: lesson.title, duration: lesson.duration }];
    }),
  );

  const [{ data: rows, error: rowsError }, { data: liveItems, error: liveError }] = await Promise.all([
    supabaseAdmin
      .from("academy_lesson_content")
      .select("lesson_id, video_url, transcript_text, duration")
      .eq("course_id", COURSE_ID),
    supabaseAdmin
      .from("academy_transcription_items")
      .select("lesson_id")
      .eq("course_id", COURSE_ID)
      .neq("status", "failed"),
  ]);
  if (rowsError) throw new Error(rowsError.message);
  if (liveError) throw new Error(liveError.message);
  const byLesson = new Map((rows ?? []).map((row) => [row.lesson_id as string, row]));
  const live = new Set((liveItems ?? []).map((row) => row.lesson_id as string));

  const budgetSeconds = budgetHours * 3600;
  let totalSeconds = 0;
  const selected: { lessonId: string; title: string; seconds: number; untimed: boolean }[] = [];
  let stoppedAt: string | null = null;
  let alreadyTimed = 0;

  for (const lesson of lessons) {
    const row = byLesson.get(lesson.id);
    const transcript = (row?.transcript_text as string | null)?.trim() ?? "";
    if (transcript && isTimedTranscript(transcript)) {
      alreadyTimed += 1;
      continue;
    }
    if (!row?.video_url || live.has(lesson.id)) continue;
    const seconds = durationLabelToSeconds((row.duration as string | null) ?? lesson.duration) ?? 0;
    if (totalSeconds + seconds > budgetSeconds) {
      stoppedAt = `${lesson.title} (${lesson.id})`;
      break;
    }
    totalSeconds += seconds;
    selected.push({ lessonId: lesson.id, title: lesson.title, seconds, untimed: Boolean(transcript) });
  }

  console.log(
    JSON.stringify(
      {
        budgetHours,
        alreadyTimed,
        inProgress: live.size,
        selectedCount: selected.length,
        selectedHours: Math.round((totalSeconds / 3600) * 100) / 100,
        replacingUntimed: selected.filter((s) => s.untimed).length,
        first: selected[0]?.title ?? null,
        last: selected.at(-1)?.title ?? null,
        nextMonthStartsAt: stoppedAt,
      },
      null,
      2,
    ),
  );

  if (dryRun || selected.length === 0) {
    console.log(dryRun ? "Dry run only, nothing queued." : "Nothing to queue.");
    return;
  }
  if (selected.length > 100) throw new Error("Happy Scribe batches hold at most 100 lessons; lower --hours.");

  const untimedIds = selected.filter((s) => s.untimed).map((s) => s.lessonId);
  if (untimedIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("academy_lesson_content")
      .update({ transcript_text: null, updated_at: new Date().toISOString() })
      .eq("course_id", COURSE_ID)
      .in("lesson_id", untimedIds);
    if (error) throw new Error(error.message);
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (adminError) throw new Error(adminError.message);
  if (!admin?.id) throw new Error("No admin profile found for created_by.");

  const run = await createTranscriptionBatch({
    createdBy: admin.id,
    keys: selected.map((s) => `${COURSE_ID}:${s.lessonId}`),
    service: "auto",
    language: "en",
  });
  console.log(
    `Queued run ${run.id} with ${run.requestedCount} lessons. The production cron submits them to Happy Scribe within a minute or two.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

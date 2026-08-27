import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  CONSOLIDATED_LESSON_LEGACY_ENTRIES,
  legacyLessonToConsolidatedChapter,
} from "./consolidatedLessonLegacyMap";
import { parseLessonVideoChapters } from "./lessonVideoChapters";
import { setLessonProgressStatus } from "./lessonProgress";
import type { LessonProgressMap, LessonProgressStatus } from "./lessonProgressTypes";
import { progressCourseId } from "./programmeContentSource";

/** `${lessonId}:${chapterId}` → completed */
export type LessonChapterProgressMap = Record<string, true>;

type ChapterProgressRow = {
  lesson_id: string;
  chapter_id: string;
};

export function lessonChapterProgressKey(
  lessonId: string,
  chapterId: string
): string {
  return `${lessonId}:${chapterId}`;
}

/**
 * Overlay completed pre-consolidation lessons onto chapter ticks so coaches
 * keep credit after lessons were merged (and renamed) into parents.
 */
export function mergeLegacyLessonProgressIntoChapters(
  lessonProgress: LessonProgressMap,
  chapterProgress: LessonChapterProgressMap
): LessonChapterProgressMap {
  const merged: LessonChapterProgressMap = { ...chapterProgress };
  for (const [lessonId, status] of Object.entries(lessonProgress)) {
    if (status !== "completed") continue;
    const mapped = legacyLessonToConsolidatedChapter(lessonId);
    if (!mapped) continue;
    merged[
      lessonChapterProgressKey(mapped.consolidatedLessonId, mapped.chapterId)
    ] = true;
  }
  return merged;
}

/**
 * When every chapter under a consolidated parent is done, treat the parent
 * lesson as completed in the progress map (display + counts).
 */
export function mergeConsolidatedParentCompletions(
  lessonProgress: LessonProgressMap,
  chapterProgress: LessonChapterProgressMap
): LessonProgressMap {
  const merged: LessonProgressMap = { ...lessonProgress };
  for (const entry of CONSOLIDATED_LESSON_LEGACY_ENTRIES) {
    const chapterIds = Object.values(entry.legacyChapterByLessonId);
    if (chapterIds.length === 0) continue;
    const allDone = chapterIds.every(
      (chapterId) =>
        chapterProgress[
          lessonChapterProgressKey(entry.consolidatedLessonId, chapterId)
        ]
    );
    if (!allDone) continue;
    const current = merged[entry.consolidatedLessonId];
    if (current === "completed") continue;
    merged[entry.consolidatedLessonId] = "completed";
  }
  return merged;
}

export async function loadLessonChapterProgressForUser(
  userId: string
): Promise<LessonChapterProgressMap> {
  const { data, error } = await supabaseAdmin
    .from("academy_lesson_chapter_progress")
    .select("lesson_id, chapter_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[lessonChapterProgress] load user:", error.message);
    return {};
  }

  const map: LessonChapterProgressMap = {};
  for (const row of (data ?? []) as ChapterProgressRow[]) {
    map[lessonChapterProgressKey(row.lesson_id, row.chapter_id)] = true;
  }
  return map;
}

async function requiredChapterIdsForLesson(lessonId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("video_chapters")
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) {
    console.error("[lessonChapterProgress] load chapters:", error.message);
    return [];
  }

  const chapters = parseLessonVideoChapters(data?.video_chapters);
  return chapters.filter((c) => !c.optional).map((c) => c.id);
}

async function loadCompletedChapterIds(input: {
  userId: string;
  lessonId: string;
}): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("academy_lesson_chapter_progress")
    .select("chapter_id")
    .eq("user_id", input.userId)
    .eq("lesson_id", input.lessonId);

  if (error) {
    console.error("[lessonChapterProgress] load lesson chapters:", error.message);
    return new Set();
  }

  return new Set(
    ((data ?? []) as { chapter_id: string }[]).map((row) => row.chapter_id)
  );
}

/** Mark parent lesson completed iff every required chapter is done. */
export async function syncParentLessonFromChapters(input: {
  userId: string;
  courseId: string;
  lessonId: string;
  actorId: string;
}): Promise<{ ok: true; parentStatus: LessonProgressStatus } | { ok: false; error: string }> {
  const courseId = progressCourseId(input.courseId, input.lessonId);
  const required = await requiredChapterIdsForLesson(input.lessonId);
  if (required.length === 0) {
    return { ok: true, parentStatus: "not_started" };
  }

  const completed = await loadCompletedChapterIds({
    userId: input.userId,
    lessonId: input.lessonId,
  });
  const allDone = required.every((id) => completed.has(id));

  // Only auto-complete when every chapter is done. Clearing a chapter clears
  // the parent tick so the sidebar stays honest; leave other statuses alone
  // when chapters are only partially done and the parent was never completed.
  if (allDone) {
    const result = await setLessonProgressStatus({
      userId: input.userId,
      courseId,
      lessonId: input.lessonId,
      status: "completed",
      actorId: input.actorId,
    });
    if (!result.ok) return result;
    return { ok: true, parentStatus: result.status };
  }

  const { data: existingRows } = await supabaseAdmin
    .from("academy_lesson_progress")
    .select("status")
    .eq("user_id", input.userId)
    .eq("lesson_id", input.lessonId);

  const statuses = ((existingRows ?? []) as { status: LessonProgressStatus }[]).map(
    (row) => row.status
  );
  if (statuses.includes("completed")) {
    const result = await setLessonProgressStatus({
      userId: input.userId,
      courseId,
      lessonId: input.lessonId,
      status: "not_started",
      actorId: input.actorId,
    });
    if (!result.ok) return result;
    return { ok: true, parentStatus: result.status };
  }

  return {
    ok: true,
    parentStatus: statuses.includes("needs_review") ? "needs_review" : "not_started",
  };
}

export async function setLessonChapterCompleted(input: {
  userId: string;
  courseId: string;
  lessonId: string;
  chapterId: string;
  completed: boolean;
}): Promise<
  | { ok: true; parentStatus: LessonProgressStatus }
  | { ok: false; error: string }
> {
  const courseId = progressCourseId(input.courseId, input.lessonId);

  if (!input.completed) {
    const { error } = await supabaseAdmin
      .from("academy_lesson_chapter_progress")
      .delete()
      .eq("user_id", input.userId)
      .eq("lesson_id", input.lessonId)
      .eq("chapter_id", input.chapterId);

    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabaseAdmin.from("academy_lesson_chapter_progress").upsert(
      {
        user_id: input.userId,
        course_id: courseId,
        lesson_id: input.lessonId,
        chapter_id: input.chapterId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_id,lesson_id,chapter_id" }
    );

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  const synced = await syncParentLessonFromChapters({
    userId: input.userId,
    courseId,
    lessonId: input.lessonId,
    actorId: input.userId,
  });

  if (!synced.ok) {
    return { ok: false, error: synced.error };
  }

  return { ok: true, parentStatus: synced.parentStatus };
}

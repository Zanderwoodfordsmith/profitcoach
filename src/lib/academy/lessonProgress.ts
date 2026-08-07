import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type {
  LessonProgressMap,
  LessonProgressStatus,
  LessonViewMap,
} from "./lessonProgressTypes";
import { progressCourseId } from "./programmeContentSource";

type ProgressRow = {
  lesson_id: string;
  status: LessonProgressStatus;
};

type ViewRow = {
  lesson_id: string;
  viewed_at: string;
};

/** Highest wins when the same lesson is stored under more than one course id. */
const STATUS_RANK: Record<LessonProgressStatus, number> = {
  not_started: 0,
  needs_review: 1,
  completed: 2,
};

/**
 * Progress for every lesson the coach has touched, keyed by lesson id.
 *
 * Hub cards regroup the same lessons under different course ids, so scoping a
 * read to one card id would hide ticks earned from another card. Lesson ids are
 * unique across the catalog, which makes a user-wide map safe to merge.
 */
export async function loadLessonProgressForUser(
  userId: string,
): Promise<LessonProgressMap> {
  const { data, error } = await supabaseAdmin
    .from("academy_lesson_progress")
    .select("lesson_id, status")
    .eq("user_id", userId);

  if (error) {
    console.error("[lessonProgress] load user:", error.message);
    return {};
  }

  const map: LessonProgressMap = {};
  for (const row of (data ?? []) as ProgressRow[]) {
    const current = map[row.lesson_id];
    if (current && STATUS_RANK[current] >= STATUS_RANK[row.status]) continue;
    map[row.lesson_id] = row.status;
  }
  return map;
}

/** Last-opened timestamps for every lesson the coach has viewed. */
export async function loadLessonViewsForUser(userId: string): Promise<LessonViewMap> {
  const { data, error } = await supabaseAdmin
    .from("academy_lesson_views")
    .select("lesson_id, viewed_at")
    .eq("user_id", userId);

  if (error) {
    console.error("[lessonProgress] load user views:", error.message);
    return {};
  }

  const map: LessonViewMap = {};
  for (const row of (data ?? []) as ViewRow[]) {
    const current = map[row.lesson_id];
    if (current && current >= row.viewed_at) continue;
    map[row.lesson_id] = row.viewed_at;
  }
  return map;
}

export async function touchLessonView(input: {
  userId: string;
  courseId: string;
  lessonId: string;
}): Promise<{ ok: true; viewedAt: string } | { ok: false; error: string }> {
  const viewedAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from("academy_lesson_views").upsert(
    {
      user_id: input.userId,
      course_id: progressCourseId(input.courseId, input.lessonId),
      lesson_id: input.lessonId,
      viewed_at: viewedAt,
    },
    { onConflict: "user_id,course_id,lesson_id" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, viewedAt };
}

export async function setLessonProgressStatus(input: {
  userId: string;
  courseId: string;
  lessonId: string;
  status: LessonProgressStatus;
  actorId: string;
}): Promise<{ ok: true; status: LessonProgressStatus } | { ok: false; error: string }> {
  const courseId = progressCourseId(input.courseId, input.lessonId);

  const { data: existing } = await supabaseAdmin
    .from("academy_lesson_progress")
    .select("status")
    .eq("user_id", input.userId)
    .eq("course_id", courseId)
    .eq("lesson_id", input.lessonId)
    .maybeSingle();

  const fromStatus = (existing?.status as LessonProgressStatus | undefined) ?? "not_started";

  if (fromStatus === input.status) {
    return { ok: true, status: input.status };
  }

  if (input.status === "not_started") {
    // Clear every course id the lesson may have been stored under, so unticking
    // cannot leave a stale row from an older hub layout behind.
    const { error: deleteError } = await supabaseAdmin
      .from("academy_lesson_progress")
      .delete()
      .eq("user_id", input.userId)
      .eq("lesson_id", input.lessonId);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }
  } else {
    const { error: upsertError } = await supabaseAdmin.from("academy_lesson_progress").upsert(
      {
        user_id: input.userId,
        course_id: courseId,
        lesson_id: input.lessonId,
        status: input.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_id,lesson_id" },
    );

    if (upsertError) {
      return { ok: false, error: upsertError.message };
    }
  }

  const { error: eventError } = await supabaseAdmin.from("academy_lesson_progress_events").insert({
    user_id: input.userId,
    course_id: courseId,
    lesson_id: input.lessonId,
    from_status: fromStatus,
    to_status: input.status,
    actor_id: input.actorId,
  });

  if (eventError) {
    console.error("[lessonProgress] event insert:", eventError.message);
  }

  return { ok: true, status: input.status };
}

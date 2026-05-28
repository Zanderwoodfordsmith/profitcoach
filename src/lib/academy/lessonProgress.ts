import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { LessonProgressMap, LessonProgressStatus } from "./lessonProgressTypes";

type ProgressRow = {
  lesson_id: string;
  status: LessonProgressStatus;
};

export async function loadLessonProgressForCourse(
  userId: string,
  courseId: string,
): Promise<LessonProgressMap> {
  const { data, error } = await supabaseAdmin
    .from("academy_lesson_progress")
    .select("lesson_id, status")
    .eq("user_id", userId)
    .eq("course_id", courseId);

  if (error) {
    console.error("[lessonProgress] load:", error.message);
    return {};
  }

  const map: LessonProgressMap = {};
  for (const row of (data ?? []) as ProgressRow[]) {
    map[row.lesson_id] = row.status;
  }
  return map;
}

export async function setLessonProgressStatus(input: {
  userId: string;
  courseId: string;
  lessonId: string;
  status: LessonProgressStatus;
  actorId: string;
}): Promise<{ ok: true; status: LessonProgressStatus } | { ok: false; error: string }> {
  const { data: existing } = await supabaseAdmin
    .from("academy_lesson_progress")
    .select("status")
    .eq("user_id", input.userId)
    .eq("course_id", input.courseId)
    .eq("lesson_id", input.lessonId)
    .maybeSingle();

  const fromStatus = (existing?.status as LessonProgressStatus | undefined) ?? "not_started";

  if (fromStatus === input.status) {
    return { ok: true, status: input.status };
  }

  if (input.status === "not_started") {
    const { error: deleteError } = await supabaseAdmin
      .from("academy_lesson_progress")
      .delete()
      .eq("user_id", input.userId)
      .eq("course_id", input.courseId)
      .eq("lesson_id", input.lessonId);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }
  } else {
    const { error: upsertError } = await supabaseAdmin.from("academy_lesson_progress").upsert(
      {
        user_id: input.userId,
        course_id: input.courseId,
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
    course_id: input.courseId,
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

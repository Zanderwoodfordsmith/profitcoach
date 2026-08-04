import {
  classroomCourseIdForLesson,
  loadClassroomHub,
} from "@/lib/academy/classroomHubLoad";
import { findLessonById, lessonContext } from "@/lib/academy/hubCatalog";
import type { ActionOutlineLine } from "@/lib/actionPlans/types";

export type EnrichedActionOutlineLine = ActionOutlineLine & {
  academyCourseId?: string | null;
  academyLessonId?: string | null;
  lessonTitle?: string | null;
  lessonHref?: string | null;
  sectionTitle?: string | null;
};

type DbRowWithAcademy = {
  academy_course_id?: string | null;
  academy_lesson_id?: string | null;
};

/** Attach classroom lesson/section metadata for My Actions display. */
export function enrichActionLinesWithLessons(
  lines: ActionOutlineLine[],
  rows: DbRowWithAcademy[]
): EnrichedActionOutlineLine[] {
  let hub: ReturnType<typeof loadClassroomHub> | null = null;
  try {
    hub = loadClassroomHub();
  } catch {
    hub = null;
  }

  return lines.map((line, index) => {
    const row = rows[index];
    const academyCourseId = row?.academy_course_id ?? null;
    const academyLessonId = row?.academy_lesson_id ?? null;
    if (!academyLessonId || !hub) {
      return {
        ...line,
        academyCourseId,
        academyLessonId,
      };
    }

    const ctx = lessonContext(hub, academyLessonId);
    const lesson = ctx?.lesson ?? findLessonById(hub, academyLessonId);
    const hubCourseId =
      classroomCourseIdForLesson(hub, academyLessonId) ??
      ctx?.course.id ??
      academyCourseId;
    const lessonHref =
      hubCourseId && academyLessonId
        ? `/academy/classroom/${encodeURIComponent(hubCourseId)}/${encodeURIComponent(academyLessonId)}`
        : null;

    return {
      ...line,
      academyCourseId,
      academyLessonId,
      lessonTitle: lesson?.title ?? null,
      sectionTitle: ctx?.section.title ?? null,
      lessonHref,
    };
  });
}

import { CLASSROOM_COURSE_ID_ALIASES } from "@/lib/academy/classroomIds";
import { CLASSROOM_LESSON_ID_ALIASES } from "@/lib/academy/classroomLessonIdAliases.generated";

const LESSON_ID_REVERSE_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(CLASSROOM_LESSON_ID_ALIASES).map(([oldId, newId]) => [newId, oldId])
);

export function resolveClassroomCourseId(courseId: string): string {
  return CLASSROOM_COURSE_ID_ALIASES[courseId] ?? courseId;
}

export function resolveClassroomLessonId(lessonId: string): string {
  return CLASSROOM_LESSON_ID_ALIASES[lessonId] ?? lessonId;
}

/** Previous id for a renamed lesson (for dual-read during migrate/deploy). */
export function legacyClassroomLessonId(lessonId: string): string | null {
  return LESSON_ID_REVERSE_ALIASES[lessonId] ?? null;
}

export function classroomLessonIdLookupKeys(lessonId: string): string[] {
  const canonical = resolveClassroomLessonId(lessonId);
  const legacy = legacyClassroomLessonId(canonical);
  return [...new Set([lessonId, canonical, legacy].filter(Boolean) as string[])];
}

export function classroomIdsNeedRedirect(
  courseId: string,
  lessonId?: string | null
): boolean {
  if (resolveClassroomCourseId(courseId) !== courseId) return true;
  if (lessonId && resolveClassroomLessonId(lessonId) !== lessonId) return true;
  return false;
}

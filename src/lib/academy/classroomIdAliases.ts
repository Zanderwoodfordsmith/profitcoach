import { CLASSROOM_COURSE_ID_ALIASES } from "@/lib/academy/classroomIds";
import { CLASSROOM_LESSON_ID_ALIASES } from "@/lib/academy/classroomLessonIdAliases.generated";

/** Manual aliases for post-rename consolidations (keep generated file clean). */
const EXTRA_LESSON_ID_ALIASES: Record<string, string> = {
  "get-calls-lead-generation-launch-your-connector-campaign":
    "get-calls-lead-generation-get-started-with-connector",
  "get-calls-connector-launch-your-connector-campaign":
    "get-calls-lead-generation-get-started-with-connector",
};

const LESSON_ID_ALIASES: Record<string, string> = {
  ...CLASSROOM_LESSON_ID_ALIASES,
  ...EXTRA_LESSON_ID_ALIASES,
};

const LESSON_ID_REVERSE_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(LESSON_ID_ALIASES).map(([oldId, newId]) => [newId, oldId])
);

export function resolveClassroomCourseId(courseId: string): string {
  return CLASSROOM_COURSE_ID_ALIASES[courseId] ?? courseId;
}

export function resolveClassroomLessonId(lessonId: string): string {
  return LESSON_ID_ALIASES[lessonId] ?? lessonId;
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

/** Keep chapter + seek time across classroom lesson redirects. */
export function classroomLessonQueryString(sp: {
  chapter?: string | null;
  t?: string | null;
}): string {
  const params = new URLSearchParams();
  const chapter = sp.chapter?.trim();
  if (chapter) params.set("chapter", chapter);
  const rawT = sp.t?.trim();
  if (rawT) {
    const seconds = Number(rawT);
    if (Number.isFinite(seconds) && seconds >= 0) {
      params.set("t", String(Math.floor(seconds)));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

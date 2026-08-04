import "server-only";

import {
  findHubCourse,
  flattenLessonsInSections,
  flattenSections,
  type HubCourse,
  type HubLesson,
  type HubSection,
} from "@/lib/academy/hubCatalog";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";
import type {
  LessonProgressMap,
  LessonProgressStatus,
  LessonViewMap,
} from "@/lib/academy/lessonProgressTypes";
import type { SignatureModuleId } from "@/lib/signatureModelV2";
import {
  COMPASS_CLASSROOM_TARGETS,
  classroomHrefForLink,
  type ResolvedCompassClassroomLink,
} from "@/lib/signature/compassClassroomMap";

export { classroomHrefForLink };

function findSectionInCourse(
  course: HubCourse,
  sectionId: string,
): HubSection | null {
  return flattenSections(course.sections).find((s) => s.id === sectionId) ?? null;
}

function visibleLessonsInSection(
  section: HubSection,
  includeDrafts: boolean,
): HubLesson[] {
  const lessons = flattenLessonsInSections([section]);
  if (includeDrafts) return lessons;
  return lessons.filter((lesson) => lesson.draft !== true);
}

function isIncomplete(status: LessonProgressStatus | undefined): boolean {
  return status !== "completed";
}

/**
 * Prefer the most recently viewed incomplete lesson in the section; otherwise
 * the first incomplete in curriculum order; otherwise the first lesson.
 */
export function pickResumeLessonInSection(
  lessons: readonly HubLesson[],
  progress: LessonProgressMap = {},
  lastViewed: LessonViewMap = {},
): HubLesson | null {
  if (lessons.length === 0) return null;

  const incomplete = lessons.filter((lesson) =>
    isIncomplete(progress[lesson.id]),
  );
  if (incomplete.length === 0) return lessons[0] ?? null;

  let best: HubLesson | null = null;
  let bestAt = "";
  for (const lesson of incomplete) {
    const viewedAt = lastViewed[lesson.id];
    if (!viewedAt) continue;
    if (!best || viewedAt > bestAt) {
      best = lesson;
      bestAt = viewedAt;
    }
  }
  return best ?? incomplete[0] ?? null;
}

/** Server-only: reads classroom hub via Node fs. */
export function resolveCompassClassroomLink(
  moduleId: SignatureModuleId,
  options?: {
    progress?: LessonProgressMap;
    lastViewed?: LessonViewMap;
    includeDrafts?: boolean;
  },
): ResolvedCompassClassroomLink | null {
  const target = COMPASS_CLASSROOM_TARGETS[moduleId];
  if (!target) return null;

  const hub = loadClassroomHub();
  const course = findHubCourse(hub, target.courseId);
  if (!course) return null;

  const section = findSectionInCourse(course, target.sectionId);
  if (!section) return null;

  const lessons = visibleLessonsInSection(
    section,
    options?.includeDrafts === true,
  );
  const lesson = pickResumeLessonInSection(
    lessons,
    options?.progress,
    options?.lastViewed,
  );
  if (!lesson) return null;

  return {
    moduleId,
    courseId: target.courseId,
    sectionId: target.sectionId,
    lessonId: lesson.id,
  };
}

/** Server-only: reads classroom hub via Node fs. */
export function resolveAllCompassClassroomLinks(options?: {
  progress?: LessonProgressMap;
  lastViewed?: LessonViewMap;
  includeDrafts?: boolean;
}): ResolvedCompassClassroomLink[] {
  const out: ResolvedCompassClassroomLink[] = [];
  for (const moduleId of Object.keys(
    COMPASS_CLASSROOM_TARGETS,
  ) as SignatureModuleId[]) {
    const resolved = resolveCompassClassroomLink(moduleId, options);
    if (resolved) out.push(resolved);
  }
  return out;
}

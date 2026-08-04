import {
  CLASSROOM_OS_COURSE_ID,
  CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_START_COURSE_IDS,
  classroomCourseIdForLesson,
  classroomCoursesByIds,
  loadClassroomHub,
} from "@/lib/academy/classroomHubLoad";
import {
  findLessonInCourse,
  flattenLessonsInSections,
  sectionContainsLesson,
  type HubCourse,
  type HubSection,
} from "@/lib/academy/hubCatalog";
import {
  ACADEMY_ACTIONS_GROUP_TEXT,
  CLASSROOM_PATH_CARD_GROUPS,
  LESSON_GROUPED_HUB_COURSE_IDS,
  SECTION_GROUPED_HUB_COURSE_IDS,
  TITLE_BY_HUB_ID,
  TITLE_BY_PROGRAMME_ID,
} from "@/lib/actionPlans/classroomActionGroupMeta";

export {
  ACADEMY_ACTIONS_GROUP_TEXT,
  CLASSROOM_ACTION_GROUPS,
  CLASSROOM_PATH_CARD_GROUPS,
  classroomActionGroupOrderIndex,
  isClassroomActionGroupTitle,
  LESSON_GROUPED_HUB_COURSE_IDS,
  SECTION_GROUPED_HUB_COURSE_IDS,
} from "@/lib/actionPlans/classroomActionGroupMeta";
export type { ClassroomActionGroupTitle } from "@/lib/actionPlans/classroomActionGroupMeta";

function findTopLevelSection(
  course: HubCourse,
  lessonId: string
): HubSection | null {
  for (const section of course.sections) {
    if (sectionContainsLesson(section, lessonId)) return section;
  }
  return null;
}

function resolveHubCourseId(
  storedCourseId: string,
  lessonId: string
): string | null {
  if (!lessonId) return storedCourseId || null;
  try {
    const hub = loadClassroomHub();
    return classroomCourseIdForLesson(hub, lessonId) ?? (storedCourseId || null);
  } catch {
    return storedCourseId || null;
  }
}

/**
 * Top-level My Actions path card for a lesson (Get Calls, Win Clients, …).
 */
export function classroomActionPathTitleForLesson(
  storedCourseId: string,
  lessonId: string
): string {
  const hubCourseId = resolveHubCourseId(storedCourseId, lessonId);
  if (hubCourseId) {
    const fromMap = TITLE_BY_HUB_ID.get(hubCourseId);
    if (fromMap) return fromMap;
    try {
      const hub = loadClassroomHub();
      const course = hub.courses.find((row) => row.id === hubCourseId);
      if (course?.title?.trim()) return course.title.trim();
    } catch {
      // fall through
    }
  }

  return (
    TITLE_BY_PROGRAMME_ID[storedCourseId] ??
    TITLE_BY_HUB_ID.get(storedCourseId) ??
    ACADEMY_ACTIONS_GROUP_TEXT
  );
}

/**
 * Nested subgroup under a path card, or null when the path stays flat
 * (Start Here, Coach Action Plan, Profit Coach OS).
 * - Get Calls / Win Clients / Coach Clients → Classroom section
 * - Going Pro → lesson (PRO Energy, …)
 */
export function classroomActionSubgroupTitleForLesson(
  storedCourseId: string,
  lessonId: string
): string | null {
  if (!lessonId) return null;
  try {
    const hub = loadClassroomHub();
    const hubCourseId =
      classroomCourseIdForLesson(hub, lessonId) ?? storedCourseId;
    const course = hub.courses.find((row) => row.id === hubCourseId);
    if (!course) return null;

    if (LESSON_GROUPED_HUB_COURSE_IDS.has(hubCourseId)) {
      const lesson = findLessonInCourse(course, lessonId);
      return lesson?.title?.trim() || null;
    }

    if (SECTION_GROUPED_HUB_COURSE_IDS.has(hubCourseId)) {
      const section = findTopLevelSection(course, lessonId);
      return section?.title?.trim() || null;
    }
  } catch {
    return null;
  }
  return null;
}

/** @deprecated Use path + subgroup helpers. Returns the path card title. */
export function classroomActionGroupTitleForLesson(
  storedCourseId: string,
  lessonId: string
): string {
  return classroomActionPathTitleForLesson(storedCourseId, lessonId);
}

/** Ordered subgroup titles for a path card id, or [] when the path is flat. */
export function listSubgroupTitlesForPath(pathId: string): string[] {
  try {
    const hub = loadClassroomHub();
    const course = hub.courses.find((row) => row.id === pathId);
    if (!course) return [];

    if (LESSON_GROUPED_HUB_COURSE_IDS.has(pathId)) {
      return flattenLessonsInSections(course.sections)
        .map((lesson) => lesson.title.trim())
        .filter(Boolean);
    }

    if (SECTION_GROUPED_HUB_COURSE_IDS.has(pathId)) {
      return course.sections
        .map((section) => section.title.trim())
        .filter(Boolean);
    }
  } catch {
    return [];
  }
  return [];
}

export function pathUsesSubgroups(pathId: string): boolean {
  return (
    SECTION_GROUPED_HUB_COURSE_IDS.has(pathId) ||
    LESSON_GROUPED_HUB_COURSE_IDS.has(pathId)
  );
}

export function isKnownClassroomSubgroupTitle(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  try {
    for (const path of CLASSROOM_PATH_CARD_GROUPS) {
      if (listSubgroupTitlesForPath(path.id).includes(trimmed)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Global Classroom lesson order (Start Here → … → Profit Coach OS).
 */
export function buildClassroomLessonOrderIndex(): Map<string, number> {
  const hub = loadClassroomHub();
  const courses = classroomCoursesByIds(hub, [
    ...CLASSROOM_START_COURSE_IDS,
    ...CLASSROOM_PATH_COURSE_IDS,
    CLASSROOM_OS_COURSE_ID,
  ]);
  const map = new Map<string, number>();
  let index = 0;
  for (const course of courses) {
    for (const lesson of flattenLessonsInSections(course.sections)) {
      if (!map.has(lesson.id)) {
        map.set(lesson.id, index);
        index += 1;
      }
    }
  }
  return map;
}

export const CLASSROOM_ACTION_COURSE_IDS = [
  ...CLASSROOM_START_COURSE_IDS,
  ...CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_OS_COURSE_ID,
] as const;

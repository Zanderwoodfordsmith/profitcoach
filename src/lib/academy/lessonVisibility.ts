import type { AcademyCatalog, AcademyCourse, AcademyLesson } from "./types";
import type {
  HubCourse,
  HubLesson,
  HubSection,
} from "./hubCatalog";

export type LessonVisibilityOptions = {
  /** When true, draft lessons stay visible (admin). Default false. */
  includeDrafts?: boolean;
};

function isDraftLesson(lesson: { draft?: boolean }): boolean {
  return lesson.draft === true;
}

function filterLessonList<T extends { draft?: boolean; satellites?: T[] }>(
  lessons: T[],
  includeDrafts: boolean
): T[] {
  return lessons
    .filter((lesson) => includeDrafts || !isDraftLesson(lesson))
    .map((lesson) => {
      if (!lesson.satellites?.length) return lesson;
      const satellites = filterLessonList(lesson.satellites, includeDrafts);
      return { ...lesson, satellites };
    });
}

function filterLegacySection(
  section: HubSection,
  includeDrafts: boolean
): HubSection {
  return {
    ...section,
    lessons: filterLessonList(section.lessons, includeDrafts),
    sections: section.sections?.map((child) =>
      filterLegacySection(child, includeDrafts)
    ),
  };
}

/** Drop soft-deleted lessons (already removed) and hide drafts from non-admins. */
export function applyLegacyCourseVisibility(
  course: HubCourse,
  options: LessonVisibilityOptions = {}
): HubCourse {
  const includeDrafts = options.includeDrafts === true;
  return {
    ...course,
    sections: course.sections.map((section) =>
      filterLegacySection(section, includeDrafts)
    ),
  };
}

export function applyCatalogVisibility(
  catalog: AcademyCatalog,
  options: LessonVisibilityOptions = {}
): AcademyCatalog {
  const includeDrafts = options.includeDrafts === true;
  return {
    ...catalog,
    categories: (catalog.categories ?? []).map((category) => ({
      ...category,
      courses: (category.courses ?? []).map((course) =>
        applyClassroomCourseVisibility(course, { includeDrafts })
      ),
    })),
  };
}

export function applyClassroomCourseVisibility(
  course: AcademyCourse,
  options: LessonVisibilityOptions = {}
): AcademyCourse {
  const includeDrafts = options.includeDrafts === true;
  return {
    ...course,
    lessons: (course.lessons ?? []).filter(
      (lesson) => includeDrafts || !isDraftLesson(lesson)
    ),
  };
}

export function firstVisibleLessonId(
  course: HubCourse,
  preferLessonId?: string | null
): string | null {
  const flat: HubLesson[] = [];
  const walk = (sections: HubSection[]) => {
    for (const section of sections) {
      for (const lesson of section.lessons) {
        flat.push(lesson);
        if (lesson.satellites?.length) flat.push(...lesson.satellites);
      }
      if (section.sections?.length) walk(section.sections);
    }
  };
  walk(course.sections);
  if (preferLessonId && flat.some((l) => l.id === preferLessonId)) {
    return preferLessonId;
  }
  return flat[0]?.id ?? null;
}

export function nextClassroomLessonId(
  course: AcademyCourse,
  removedLessonId: string
): string | null {
  const lessons = course.lessons ?? [];
  const idx = lessons.findIndex((l) => l.id === removedLessonId);
  if (idx < 0) return lessons[0]?.id ?? null;
  return lessons[idx + 1]?.id ?? lessons[idx - 1]?.id ?? null;
}

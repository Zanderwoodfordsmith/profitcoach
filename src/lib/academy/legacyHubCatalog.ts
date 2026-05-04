export type LegacyHubLesson = {
  id: string;
  title: string;
  /**
   * Shown on the right as “(3m)”. Leave empty when the spreadsheet has not
   * supplied a length yet.
   */
  duration: string;
  /** Whether this lesson has a video on the legacy site (for the sidebar hint). */
  hasVideo: boolean;
  /** Exact destination on Business Coach Academy (Disco). */
  academyUrl: string;
  /** Optional copy for this lesson only (shown above the CTA). */
  notice?: string;
};

export type LegacyHubSection = {
  id: string;
  title: string;
  lessons: LegacyHubLesson[];
};

export type LegacyHubCourse = {
  id: string;
  title: string;
  /** Shown on the programme card under the title. */
  description?: string;
  sections: LegacyHubSection[];
};

export type LegacyHubCatalog = {
  /** Shown on every lesson panel unless the lesson sets `notice`. */
  lessonPanelNotice: string;
  courses: LegacyHubCourse[];
};

export function legacyLessonCount(course: LegacyHubCourse): number {
  return course.sections.reduce((sum, s) => sum + s.lessons.length, 0);
}

export function findLegacyCourse(
  data: LegacyHubCatalog,
  courseId: string,
): LegacyHubCourse | null {
  return data.courses.find((c) => c.id === courseId) ?? null;
}

export function findLessonInCourse(
  course: LegacyHubCourse,
  lessonId: string,
): LegacyHubLesson | null {
  for (const section of course.sections) {
    const hit = section.lessons.find((l) => l.id === lessonId);
    if (hit) return hit;
  }
  return null;
}

export function firstLessonInCourse(course: LegacyHubCourse): LegacyHubLesson | null {
  for (const section of course.sections) {
    const first = section.lessons[0];
    if (first) return first;
  }
  return null;
}

export function lessonContextInCourse(
  course: LegacyHubCourse,
  lessonId: string,
): { section: LegacyHubSection; lesson: LegacyHubLesson } | null {
  for (const section of course.sections) {
    const lesson = section.lessons.find((l) => l.id === lessonId);
    if (lesson) return { section, lesson };
  }
  return null;
}

/**
 * First lesson in the hub (any course).
 * @throws If the catalog has no lessons (misconfigured JSON).
 */
export function firstLessonInHub(data: LegacyHubCatalog): LegacyHubLesson {
  for (const course of data.courses) {
    const first = firstLessonInCourse(course);
    if (first) return first;
  }
  throw new Error("legacyHubCatalog: catalog has no lessons");
}

export function findLessonById(
  data: LegacyHubCatalog,
  lessonId: string,
): LegacyHubLesson | null {
  for (const course of data.courses) {
    const hit = findLessonInCourse(course, lessonId);
    if (hit) return hit;
  }
  return null;
}

export type LegacyHubLessonContext = {
  course: LegacyHubCourse;
  section: LegacyHubSection;
  lesson: LegacyHubLesson;
};

/** Resolve course + section for a lesson id anywhere in the hub. */
export function lessonContext(
  data: LegacyHubCatalog,
  lessonId: string,
): LegacyHubLessonContext | null {
  for (const course of data.courses) {
    const inCourse = lessonContextInCourse(course, lessonId);
    if (inCourse) {
      return {
        course,
        section: inCourse.section,
        lesson: inCourse.lesson,
      };
    }
  }
  return null;
}

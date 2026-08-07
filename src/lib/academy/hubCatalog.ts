import type { AcademyRecommendedAction } from "./lessonActions";

export type HubLesson = {
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
  /** Short blurb for satellite playlist rows under a parent lesson. */
  description?: string;
  /**
   * Optional extras nested under this lesson (not required path).
   * Still full lessons with their own ids / progress / content rows.
   */
  satellites?: HubLesson[];
  /** Set when merged from `academy_lesson_content` (in-app lesson). */
  videoUrl?: string | null;
  /** Optional listen-along audio under the video. */
  audioUrl?: string | null;
  /** Overview tab content. */
  bodyMarkdown?: string;
  /** Optional Guide tab (longer written walkthrough / SOP). */
  guideMarkdown?: string;
  /** Recommended next steps shown beside Overview. */
  recommendedActions?: AcademyRecommendedAction[];
  /** Plain-text transcript (Transcript tab). */
  transcriptText?: string | null;
  /**
   * Admin-only: coaches never see draft lessons.
   * From hub JSON and/or `academy_lesson_content.is_draft`.
   */
  draft?: boolean;
};

export type HubSection = {
  id: string;
  title: string;
  lessons: HubLesson[];
  /** Optional nested categories (e.g. Coach Certification grouping). */
  sections?: HubSection[];
  /**
   * `rule` = left-aligned tier label only (e.g. Core / Premium), not expandable.
   * Default / omitted = normal collapsible accordion category.
   */
  presentation?: "accordion" | "rule";
};

export type HubCourse = {
  id: string;
  title: string;
  /** Shown on the programme card under the title. */
  description?: string;
  sections: HubSection[];
};

export type HubCatalog = {
  /** Shown on every lesson panel unless the lesson sets `notice`. */
  lessonPanelNotice: string;
  courses: HubCourse[];
};

/** Main lessons only (satellites are optional extras and do not inflate progress). */
export function sectionLessonCount(section: HubSection): number {
  const nested = (section.sections ?? []).reduce(
    (sum, child) => sum + sectionLessonCount(child),
    0,
  );
  return section.lessons.length + nested;
}

/** Parent lesson plus its satellites (one level; satellites do not nest further). */
export function lessonWithSatellites(lesson: HubLesson): HubLesson[] {
  return [lesson, ...(lesson.satellites ?? [])];
}

/** Every addressable lesson in a section tree, including satellites. */
export function flattenLessonsInSections(sections: HubSection[]): HubLesson[] {
  const out: HubLesson[] = [];
  for (const section of flattenSections(sections)) {
    for (const lesson of section.lessons) {
      out.push(...lessonWithSatellites(lesson));
    }
  }
  return out;
}

/** Main curriculum lessons only (excludes satellite / FAQ extras). */
export function flattenMainLessonsInSections(sections: HubSection[]): HubLesson[] {
  const out: HubLesson[] = [];
  for (const section of flattenSections(sections)) {
    out.push(...section.lessons);
  }
  return out;
}

function findLessonAmong(lessons: HubLesson[], lessonId: string): HubLesson | null {
  for (const lesson of lessons) {
    if (lesson.id === lessonId) return lesson;
    const sat = lesson.satellites?.find((s) => s.id === lessonId);
    if (sat) return sat;
  }
  return null;
}

/** Parent of a satellite lesson, if `lessonId` is nested under a main lesson. */
export function findParentLessonInCourse(
  course: HubCourse,
  lessonId: string,
): HubLesson | null {
  for (const section of flattenSections(course.sections)) {
    for (const lesson of section.lessons) {
      if (lesson.satellites?.some((s) => s.id === lessonId)) return lesson;
    }
  }
  return null;
}

/** Parse hub duration strings like `23m`, `0.5m`, `(15m)` into minutes. */
export function parseDurationMinutes(raw: string): number {
  const t = raw.trim().replace(/^\(|\)$/g, "").trim().toLowerCase();
  if (!t) return 0;
  const hm = t.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs|our|ours)?\s*(\d+(?:\.\d+)?)?\s*m(?:in(?:ute)?s?)?$/);
  if (hm) {
    return Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);
  }
  const hoursOnly = t.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs|our|ours)?$/);
  if (hoursOnly) return Number(hoursOnly[1]) * 60;
  const mins = t.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/);
  if (mins) return Number(mins[1]);
  const bare = Number(t);
  return Number.isFinite(bare) ? bare : 0;
}

/** Format total minutes as `45m` or `1h 16m`. */
export function formatDurationMinutes(totalMinutes: number): string | null {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null;
  const rounded = Math.round(totalMinutes);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Sidebar / catalog duration from media length (seconds → `23m` / `1h 5m`). */
export function formatLessonDurationFromSeconds(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return formatDurationMinutes(minutes);
}

export function hubLessonCount(course: HubCourse): number {
  return course.sections.reduce((sum, s) => sum + sectionLessonCount(s), 0);
}

/** Depth-first list of every section including nested children. */
export function flattenSections(sections: HubSection[]): HubSection[] {
  const out: HubSection[] = [];
  for (const section of sections) {
    out.push(section);
    if (section.sections?.length) {
      out.push(...flattenSections(section.sections));
    }
  }
  return out;
}

/** Sum of main lesson durations in a section (nested sections included; satellites excluded). */
export function sectionDurationLabel(section: HubSection): string | null {
  let minutes = 0;
  for (const lesson of flattenMainLessonsInSections([section])) {
    minutes += parseDurationMinutes(lesson.duration);
  }
  return formatDurationMinutes(minutes);
}

/** Sum of main lesson durations in a course (satellites excluded). */
export function courseDurationLabel(course: HubCourse): string | null {
  let minutes = 0;
  for (const lesson of flattenMainLessonsInSections(course.sections)) {
    minutes += parseDurationMinutes(lesson.duration);
  }
  return formatDurationMinutes(minutes);
}

export function sectionContainsLesson(
  section: HubSection,
  lessonId: string,
): boolean {
  if (findLessonAmong(section.lessons, lessonId)) return true;
  return (section.sections ?? []).some((child) =>
    sectionContainsLesson(child, lessonId),
  );
}

export function findHubCourse(
  data: HubCatalog,
  courseId: string,
): HubCourse | null {
  return data.courses.find((c) => c.id === courseId) ?? null;
}

export function findLessonInCourse(
  course: HubCourse,
  lessonId: string,
): HubLesson | null {
  for (const section of flattenSections(course.sections)) {
    const hit = findLessonAmong(section.lessons, lessonId);
    if (hit) return hit;
  }
  return null;
}

export function firstLessonInCourse(course: HubCourse): HubLesson | null {
  for (const section of flattenSections(course.sections)) {
    const first = section.lessons[0];
    if (first) return first;
  }
  return null;
}

/**
 * Next addressable lesson after `lessonId` in course order (sections + satellites).
 * Skips drafts unless `includeDrafts` is set (admin preview).
 */
export function nextLessonInCourse(
  course: HubCourse,
  lessonId: string,
  options?: { includeDrafts?: boolean },
): HubLesson | null {
  return nextLessonInSequence(
    flattenLessonsInSections(course.sections),
    lessonId,
    options,
  );
}

/** Next lesson in a flat ordered list (e.g. Compass courses). */
export function nextLessonInSequence<T extends { id: string; draft?: boolean }>(
  lessons: readonly T[],
  lessonId: string,
  options?: { includeDrafts?: boolean },
): T | null {
  const includeDrafts = options?.includeDrafts === true;
  const visible = includeDrafts
    ? [...lessons]
    : lessons.filter((lesson) => lesson.draft !== true);
  const index = visible.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return null;
  return visible[index + 1] ?? null;
}

export function lessonContextInCourse(
  course: HubCourse,
  lessonId: string,
): {
  section: HubSection;
  lesson: HubLesson;
  parentLesson: HubLesson | null;
} | null {
  for (const section of flattenSections(course.sections)) {
    for (const lesson of section.lessons) {
      if (lesson.id === lessonId) {
        return { section, lesson, parentLesson: null };
      }
      const sat = lesson.satellites?.find((s) => s.id === lessonId);
      if (sat) {
        return { section, lesson: sat, parentLesson: lesson };
      }
    }
  }
  return null;
}

/**
 * First lesson in the hub (any course).
 * @throws If the catalog has no lessons (misconfigured JSON).
 */
export function firstLessonInHub(data: HubCatalog): HubLesson {
  for (const course of data.courses) {
    const first = firstLessonInCourse(course);
    if (first) return first;
  }
  throw new Error("hubCatalog: catalog has no lessons");
}

export function findLessonById(
  data: HubCatalog,
  lessonId: string,
): HubLesson | null {
  for (const course of data.courses) {
    const hit = findLessonInCourse(course, lessonId);
    if (hit) return hit;
  }
  return null;
}

export type HubLessonContext = {
  course: HubCourse;
  section: HubSection;
  lesson: HubLesson;
};

/** Resolve course + section for a lesson id anywhere in the hub. */
export function lessonContext(
  data: HubCatalog,
  lessonId: string,
): HubLessonContext | null {
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

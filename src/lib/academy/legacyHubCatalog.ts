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
  /** Set when merged from `academy_lesson_content` (in-app lesson). */
  videoUrl?: string | null;
  bodyMarkdown?: string;
  /** Plain-text transcript (collapsible panel, not lesson body). */
  transcriptText?: string | null;
};

export type LegacyHubSection = {
  id: string;
  title: string;
  lessons: LegacyHubLesson[];
  /** Optional nested categories (Simplified Coach Certification grouping). */
  sections?: LegacyHubSection[];
  /**
   * `rule` = left-aligned tier label only (e.g. Core / Premium), not expandable.
   * Default / omitted = normal collapsible accordion category.
   */
  presentation?: "accordion" | "rule";
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

export function sectionLessonCount(section: LegacyHubSection): number {
  const nested = (section.sections ?? []).reduce(
    (sum, child) => sum + sectionLessonCount(child),
    0,
  );
  return section.lessons.length + nested;
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

export function legacyLessonCount(course: LegacyHubCourse): number {
  return course.sections.reduce((sum, s) => sum + sectionLessonCount(s), 0);
}

/** Depth-first list of every section including nested children. */
export function flattenSections(sections: LegacyHubSection[]): LegacyHubSection[] {
  const out: LegacyHubSection[] = [];
  for (const section of sections) {
    out.push(section);
    if (section.sections?.length) {
      out.push(...flattenSections(section.sections));
    }
  }
  return out;
}

/** Sum of lesson durations in a section (including nested sections). */
export function sectionDurationLabel(section: LegacyHubSection): string | null {
  let minutes = 0;
  for (const node of flattenSections([section])) {
    for (const lesson of node.lessons) {
      minutes += parseDurationMinutes(lesson.duration);
    }
  }
  return formatDurationMinutes(minutes);
}

/** Sum of all lesson durations in a course. */
export function courseDurationLabel(course: LegacyHubCourse): string | null {
  let minutes = 0;
  for (const node of flattenSections(course.sections)) {
    for (const lesson of node.lessons) {
      minutes += parseDurationMinutes(lesson.duration);
    }
  }
  return formatDurationMinutes(minutes);
}

export function sectionContainsLesson(
  section: LegacyHubSection,
  lessonId: string,
): boolean {
  if (section.lessons.some((l) => l.id === lessonId)) return true;
  return (section.sections ?? []).some((child) =>
    sectionContainsLesson(child, lessonId),
  );
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
  for (const section of flattenSections(course.sections)) {
    const hit = section.lessons.find((l) => l.id === lessonId);
    if (hit) return hit;
  }
  return null;
}

export function firstLessonInCourse(course: LegacyHubCourse): LegacyHubLesson | null {
  for (const section of flattenSections(course.sections)) {
    const first = section.lessons[0];
    if (first) return first;
  }
  return null;
}

export function lessonContextInCourse(
  course: LegacyHubCourse,
  lessonId: string,
): { section: LegacyHubSection; lesson: LegacyHubLesson } | null {
  for (const section of flattenSections(course.sections)) {
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

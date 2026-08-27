/**
 * Hub loaders for academy body import scripts (no `server-only` — safe in tsx).
 *
 * Combines the Classroom hub (Get Calls, Win Clients, Coach Clients, Profit
 * System tools, etc.) with the archive hub so source-doc titles resolve to
 * live `academy_lesson_content` rows.
 */

import fs from "node:fs";
import path from "node:path";

import { loadArchiveHub } from "./archiveHubLoad";
import type { HubCatalog, HubCourse, HubSection } from "./hubCatalog";
import {
  buildLegacyLessonIndex,
  type LegacyLessonIndexEntry,
} from "./legacyLessonMatcher";

const CLASSROOM_HUB_PATH = path.join(
  process.cwd(),
  "content/academy/classroom-hub.json",
);

/** Map hub lesson id → course_id stored in academy_lesson_content. */
export function importCourseIdForLesson(
  lessonId: string,
  hubCourseId: string,
): string {
  if (lessonId.startsWith("profit-brand-framework-")) return "profit-brand-framework";
  if (lessonId.startsWith("get-calls-")) return "get-calls";
  if (lessonId.startsWith("win-clients-")) return "win-clients";
  if (lessonId.startsWith("coach-clients-")) return "coach-clients";
  if (lessonId.startsWith("start-here-")) return "start-here";
  if (lessonId.startsWith("going-pro-")) return "going-pro";
  return hubCourseId;
}

/** Classroom hub (Get Calls / Win Clients are now first-class courses in JSON). */
export function loadClassroomHubForImport(): HubCatalog {
  const raw = fs.readFileSync(CLASSROOM_HUB_PATH, "utf8");
  const data = JSON.parse(raw) as HubCatalog & {
    startHere?: { courseId: string };
  };
  return data;
}

function walkSectionLessons(
  course: HubCourse,
  section: HubSection,
  out: LegacyLessonIndexEntry[],
): void {
  for (const lesson of section.lessons) {
    out.push({
      courseId: importCourseIdForLesson(lesson.id, course.id),
      courseTitle: course.title,
      sectionTitle: section.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      hasVideo: lesson.hasVideo,
    });
    for (const satellite of lesson.satellites ?? []) {
      out.push({
        courseId: importCourseIdForLesson(satellite.id, course.id),
        courseTitle: course.title,
        sectionTitle: section.title,
        lessonId: satellite.id,
        lessonTitle: satellite.title,
        hasVideo: satellite.hasVideo,
      });
    }
  }
  for (const child of section.sections ?? []) {
    walkSectionLessons(course, child, out);
  }
}

/** Flatten all lessons (incl. nested sections / satellites) from a hub catalog. */
export function buildNestedHubLessonIndex(
  catalog: HubCatalog,
): LegacyLessonIndexEntry[] {
  const out: LegacyLessonIndexEntry[] = [];
  for (const course of catalog.courses) {
    for (const section of course.sections) {
      walkSectionLessons(course, section, out);
    }
  }
  return out;
}

/**
 * Combined lesson index for body import: Classroom hub wins over archive when
 * the same lesson id appears in both.
 */
export function loadImportLessonIndex(): LegacyLessonIndexEntry[] {
  const classroom = buildNestedHubLessonIndex(loadClassroomHubForImport());
  const archive = buildLegacyLessonIndex(loadArchiveHub());

  const byLessonId = new Map<string, LegacyLessonIndexEntry>();
  for (const entry of archive) {
    byLessonId.set(entry.lessonId, {
      ...entry,
      courseId: importCourseIdForLesson(entry.lessonId, entry.courseId),
    });
  }
  for (const entry of classroom) {
    byLessonId.set(entry.lessonId, entry);
  }
  return Array.from(byLessonId.values());
}

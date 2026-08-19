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

const GET_CLIENTS_SOURCE_COURSE_ID = "get-clients";

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

function cloneSection(section: HubSection): HubSection {
  return {
    ...section,
    lessons: section.lessons.map((lesson) => ({ ...lesson })),
    sections: section.sections?.map(cloneSection),
  };
}

function buildDerivedCourse(input: {
  source: HubCourse;
  id: string;
  title: string;
  description: string;
  sectionIds: string[];
}): HubCourse {
  const pickedSections = input.sectionIds
    .map((sectionId) =>
      input.source.sections.find((section) => section.id === sectionId),
    )
    .filter((section): section is HubSection => Boolean(section))
    .map(cloneSection);

  if (pickedSections.length !== input.sectionIds.length) {
    throw new Error(
      `classroom-hub.json: missing section for derived course ${input.id}`,
    );
  }

  return {
    id: input.id,
    title: input.title,
    description: input.description,
    sections: pickedSections,
  };
}

/** Classroom hub with derived Get Calls / Win Clients courses (mirrors classroomHubLoad). */
export function loadClassroomHubForImport(): HubCatalog {
  const raw = fs.readFileSync(CLASSROOM_HUB_PATH, "utf8");
  const data = JSON.parse(raw) as HubCatalog & {
    startHere?: { courseId: string };
  };

  const getClientsSource = data.courses.find(
    (course) => course.id === GET_CLIENTS_SOURCE_COURSE_ID,
  );
  if (!getClientsSource) {
    throw new Error(
      `classroom-hub.json: expected ${GET_CLIENTS_SOURCE_COURSE_ID} course`,
    );
  }

  const getCalls = buildDerivedCourse({
    source: getClientsSource,
    id: "get-calls",
    title: "Get Calls",
    description: getClientsSource.description ?? "",
    sectionIds: [
      "get-calls-overview",
      "get-calls-step-1-choose-understand-ideal-clients",
      "get-calls-step-2-build-prospect-list",
      "get-calls-step-4-top-100-conversations",
    ],
  });
  const winClients = buildDerivedCourse({
    source: getClientsSource,
    id: "win-clients",
    title: "Win Clients",
    description: getClientsSource.description ?? "",
    sectionIds: [
      "win-clients-overview",
      "win-clients-offer-sales-foundations",
      "win-clients-value-sessions",
      "win-clients-client-closing-objections",
    ],
  });

  return {
    ...data,
    courses: [
      ...data.courses.filter(
        (course) => course.id !== GET_CLIENTS_SOURCE_COURSE_ID,
      ),
      getCalls,
      winClients,
    ],
  };
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

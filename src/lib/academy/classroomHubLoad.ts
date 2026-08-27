import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_START_COURSE_IDS,
} from "@/lib/academy/classroomIds";
import {
  findLessonInCourse,
  type HubCatalog,
  type HubCourse,
} from "@/lib/academy/hubCatalog";

export type ClassroomHubStartHere = {
  courseId: string;
  eyebrow: string;
  title: string;
  description: string;
};

export type ClassroomHubCatalog = HubCatalog & {
  startHere: ClassroomHubStartHere;
};

const CLASSROOM_HUB_PATH = path.join(
  process.cwd(),
  "content/academy/classroom-hub.json",
);

let classroomHubCache: ClassroomHubCatalog | null = null;
let classroomHubCacheMtimeMs = 0;

export {
  CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_START_COURSE_IDS,
};

export function loadClassroomHub(): ClassroomHubCatalog {
  const mtimeMs = fs.statSync(CLASSROOM_HUB_PATH).mtimeMs;
  if (classroomHubCache && classroomHubCacheMtimeMs === mtimeMs) {
    return classroomHubCache;
  }

  const raw = fs.readFileSync(CLASSROOM_HUB_PATH, "utf8");
  const data = JSON.parse(raw) as ClassroomHubCatalog;
  if (!Array.isArray(data.courses) || data.courses.length === 0) {
    throw new Error("classroom-hub.json: expected non-empty courses array");
  }
  if (!data.startHere?.courseId) {
    throw new Error("classroom-hub.json: expected startHere.courseId");
  }

  classroomHubCache = data;
  classroomHubCacheMtimeMs = mtimeMs;
  return classroomHubCache;
}

/** Hub card a lesson now lives on, for redirecting retired programme links. */
export function classroomCourseIdForLesson(
  data: ClassroomHubCatalog,
  lessonId: string,
): string | null {
  const cardIds = [
    ...CLASSROOM_START_COURSE_IDS,
    ...CLASSROOM_PATH_COURSE_IDS,
  ];
  for (const course of classroomCoursesByIds(data, cardIds)) {
    if (findLessonInCourse(course, lessonId)) return course.id;
  }
  return null;
}

export function classroomCoursesByIds(
  data: ClassroomHubCatalog,
  courseIds: readonly string[],
): HubCourse[] {
  const byId = new Map(data.courses.map((c) => [c.id, c]));
  return courseIds
    .map((id) => byId.get(id))
    .filter((c): c is HubCourse => Boolean(c));
}

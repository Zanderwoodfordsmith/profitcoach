import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  CLASSROOM_OS_COURSE_ID,
  CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_START_COURSE_IDS,
  GET_CLIENTS_SOURCE_COURSE_ID,
} from "@/lib/academy/classroomIds";
import {
  findLessonInCourse,
  type HubCatalog,
  type HubCourse,
  type HubLesson,
  type HubSection,
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
  CLASSROOM_OS_COURSE_ID,
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

  const getClientsSource = data.courses.find(
    (course) => course.id === GET_CLIENTS_SOURCE_COURSE_ID
  );
  if (!getClientsSource) {
    throw new Error(
      `classroom-hub.json: expected ${GET_CLIENTS_SOURCE_COURSE_ID} course`
    );
  }

  const getCalls = buildDerivedCourse({
    source: getClientsSource,
    id: "get-calls",
    title: "Get Calls",
    description:
      "Find ideal clients, build your list, and start real conversations that lead to calls.",
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
    description:
      "Build your offer and pricing, then book and run value sessions and roadmap calls that turn prospects into clients.",
    sectionIds: [
      "win-clients-overview",
      "win-clients-offer-sales-foundations",
      "win-clients-value-sessions",
      "win-clients-client-closing-objections",
    ],
  });
  classroomHubCache = {
    ...data,
    courses: [
      ...data.courses.filter(
        (course) => course.id !== GET_CLIENTS_SOURCE_COURSE_ID
      ),
      getCalls,
      winClients,
    ],
  };
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
    CLASSROOM_OS_COURSE_ID,
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

function cloneLesson(lesson: HubLesson): HubLesson {
  return {
    ...lesson,
    satellites: lesson.satellites?.map(cloneLesson),
  };
}

function cloneSection(section: HubSection): HubSection {
  return {
    ...section,
    lessons: section.lessons.map(cloneLesson),
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
    .map((sectionId) => input.source.sections.find((section) => section.id === sectionId))
    .filter((section): section is HubSection => Boolean(section))
    .map(cloneSection);

  if (pickedSections.length !== input.sectionIds.length) {
    throw new Error(`classroom-hub.json: missing section for derived course ${input.id}`);
  }

  return {
    id: input.id,
    title: input.title,
    description: input.description,
    sections: pickedSections,
  };
}

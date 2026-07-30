import fs from "node:fs";
import path from "node:path";

import type {
  LegacyHubCatalog,
  LegacyHubCourse,
  LegacyHubSection,
} from "@/lib/academy/legacyHubCatalog";

export type SimplifiedHubStartHere = {
  courseId: string;
  eyebrow: string;
  title: string;
  description: string;
};

export type SimplifiedHubCatalog = LegacyHubCatalog & {
  startHere: SimplifiedHubStartHere;
};

const SIMPLIFIED_HUB_PATH = path.join(
  process.cwd(),
  "content/academy/simplified-hub.json",
);

/** Primary programme cards on the Simplified catalog (Start Here + OS are feature cards). */
export const SIMPLIFIED_CATALOG_COURSE_IDS = [
  "get-calls",
  "win-clients",
  "profit-coach-system",
] as const;

export const SIMPLIFIED_OS_COURSE_ID = "profit-coach-os" as const;

/**
 * Lessons keep their Current-tab ids, so in-app video/body/resources live under
 * the original programme `course_id` (not always the Simplified course id).
 */
export function contentSourceCourseId(lessonId: string): string {
  if (lessonId.startsWith("profit-coach-os-")) return "profit-coach-os";
  if (lessonId.startsWith("profit-coach-certification-")) {
    return "profit-coach-certification";
  }
  if (lessonId.startsWith("profit-brand-framework-")) {
    return "profit-brand-framework";
  }
  if (lessonId.startsWith("client-acquisition-")) return "client-acquisition";
  if (lessonId.startsWith("client-delivery-")) return "client-delivery";
  if (lessonId.startsWith("coach-action-plan-")) return "coach-action-plan";
  if (lessonId.startsWith("going-pro-")) return "going-pro";
  if (lessonId.startsWith("kickstart-")) return "kickstart";
  return "kickstart";
}

export function loadSimplifiedHub(): SimplifiedHubCatalog {
  const raw = fs.readFileSync(SIMPLIFIED_HUB_PATH, "utf8");
  const data = JSON.parse(raw) as SimplifiedHubCatalog;
  if (!Array.isArray(data.courses) || data.courses.length === 0) {
    throw new Error("simplified-hub.json: expected non-empty courses array");
  }
  if (!data.startHere?.courseId) {
    throw new Error("simplified-hub.json: expected startHere.courseId");
  }

  const clientAcquisition = data.courses.find((course) => course.id === "client-acquisition");
  if (!clientAcquisition) {
    throw new Error("simplified-hub.json: expected client-acquisition course");
  }

  const getCalls = buildDerivedCourse({
    source: clientAcquisition,
    id: "get-calls",
    title: "Get Calls",
    description:
      "Find ideal clients, build your list, and start real conversations that lead to calls.",
    sectionIds: [
      "client-acquisition-step-1-choose-understand-ideal-clients",
      "client-acquisition-step-2-build-prospect-list",
      "client-acquisition-step-3-profile-calendar",
      "client-acquisition-step-4-top-100-conversations",
    ],
  });
  const winClients = buildDerivedCourse({
    source: clientAcquisition,
    id: "win-clients",
    title: "Win Clients",
    description:
      "Book and run value sessions and roadmap calls that turn prospects into clients.",
    sectionIds: [
      "client-acquisition-step-5-value-sessions",
      "client-acquisition-step-6-sales-calls",
    ],
  });
  // Win Clients is its own path — renumber from the original Get Clients 5/6.
  winClients.sections = winClients.sections.map((section, index) => ({
    ...section,
    title: section.title.replace(/^\d+\./, `${index + 1}.`),
  }));

  return {
    ...data,
    courses: [
      ...data.courses.filter((course) => course.id !== "client-acquisition"),
      getCalls,
      winClients,
    ],
  };
}

export function simplifiedCatalogCourses(
  data: SimplifiedHubCatalog,
): LegacyHubCourse[] {
  const byId = new Map(data.courses.map((c) => [c.id, c]));
  return SIMPLIFIED_CATALOG_COURSE_IDS.map((id) => byId.get(id)).filter(
    (c): c is LegacyHubCourse => Boolean(c),
  );
}

function cloneSection(section: LegacyHubSection): LegacyHubSection {
  return {
    ...section,
    lessons: [...section.lessons],
    sections: section.sections?.map(cloneSection),
  };
}

function buildDerivedCourse(input: {
  source: LegacyHubCourse;
  id: string;
  title: string;
  description: string;
  sectionIds: string[];
}): LegacyHubCourse {
  const pickedSections = input.sectionIds
    .map((sectionId) => input.source.sections.find((section) => section.id === sectionId))
    .filter((section): section is LegacyHubSection => Boolean(section))
    .map(cloneSection);

  if (pickedSections.length !== input.sectionIds.length) {
    throw new Error(`simplified-hub.json: missing section for derived course ${input.id}`);
  }

  return {
    id: input.id,
    title: input.title,
    description: input.description,
    sections: pickedSections,
  };
}

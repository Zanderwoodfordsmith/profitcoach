import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  CLASSROOM_OS_COURSE_ID,
  CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_START_COURSE_IDS,
} from "./classroomIds";
import {
  classroomCoursesByIds,
  loadClassroomHub,
} from "./classroomHubLoad";
import {
  type HubCourse,
  type HubLesson,
  type HubSection,
} from "./hubCatalog";
import { contentSourceCourseId } from "./programmeContentSource";
import {
  lessonVideoImportStatus,
  type LessonImportCatalogOrder,
  type LessonImportCatalogSection,
  type LessonImportStatusReport,
  type LessonImportStatusRow,
} from "./lessonImportStatusClient";

export type {
  LessonImportCatalogOrder,
  LessonImportCatalogSection,
  LessonImportCourseGroup,
  LessonImportFilter,
  LessonImportSectionGroup,
  LessonImportStatusReport,
  LessonImportStatusRow,
  LessonImportStatusSummary,
  LessonVideoImportStatus,
} from "./lessonImportStatusClient";

export {
  buildOrderedCourseGroups,
  collectSectionKeys,
  lessonMatchesImportFilter,
} from "./lessonImportStatusClient";

export { lessonVideoImportStatus } from "./lessonImportStatusClient";

type ContentRow = {
  course_id: string;
  lesson_id: string;
  video_url: string | null;
  body_markdown: string | null;
  transcript_text: string | null;
};

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

const CLASSROOM_DISPLAY_ORDER = [
  ...CLASSROOM_START_COURSE_IDS,
  ...CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_OS_COURSE_ID,
] as const;

function catalogSectionFromHub(section: HubSection): LessonImportCatalogSection {
  return {
    id: section.id,
    title: section.title,
    presentation: section.presentation,
    lessonIds: section.lessons.map((l) => l.id),
    sections: section.sections?.map(catalogSectionFromHub),
  };
}

/** Classroom card order (Start Here → … → Profit Coach OS), nested categories preserved. */
function catalogOrderFromHub(
  hub: ReturnType<typeof loadClassroomHub>,
): LessonImportCatalogOrder {
  const ordered = classroomCoursesByIds(hub, CLASSROOM_DISPLAY_ORDER);
  const orderedIds = new Set(ordered.map((c) => c.id));
  const remainder = hub.courses.filter((c) => !orderedIds.has(c.id));

  return {
    courses: [...ordered, ...remainder].map((course) => ({
      id: course.id,
      title: course.title,
      sections: course.sections.map(catalogSectionFromHub),
    })),
  };
}

function rowFromLesson(
  course: HubCourse,
  sectionTitle: string,
  lesson: HubLesson,
  content: ContentRow | undefined,
  adminBasePath: string,
): LessonImportStatusRow {
  const hasInAppVideo = Boolean(content?.video_url?.trim());
  const hasContent = Boolean(content?.body_markdown?.trim());
  const hasTranscript = Boolean(content?.transcript_text?.trim());
  const legacyExpectsVideo = lesson.hasVideo;
  const missingVideo = legacyExpectsVideo && !hasInAppVideo;
  const missingContent = !hasContent;
  /** Video lessons (in app or expected from legacy) need a transcript. */
  const missingTranscript =
    (hasInAppVideo || legacyExpectsVideo) && !hasTranscript;
  const videoStatus = lessonVideoImportStatus({ legacyExpectsVideo, hasInAppVideo });

  return {
    courseId: course.id,
    courseTitle: course.title,
    sectionTitle,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    legacyExpectsVideo,
    hasInAppVideo,
    hasContent,
    hasTranscript,
    videoStatus,
    missingVideo,
    missingContent,
    missingTranscript,
    adminLessonHref: `${adminBasePath}/${course.id}/${lesson.id}`,
  };
}

function collectLessonRows(
  course: HubCourse,
  sections: HubSection[],
  byKey: Map<string, ContentRow>,
  adminBasePath: string,
  out: LessonImportStatusRow[],
) {
  for (const section of sections) {
    for (const lesson of section.lessons) {
      out.push(
        rowFromLesson(
          course,
          section.title,
          lesson,
          byKey.get(lessonKey(contentSourceCourseId(lesson.id), lesson.id)),
          adminBasePath,
        ),
      );
    }
    if (section.sections?.length) {
      collectLessonRows(course, section.sections, byKey, adminBasePath, out);
    }
  }
}

export async function loadLessonImportStatusReport(
  adminBasePath = "/admin/academy/classroom",
): Promise<LessonImportStatusReport> {
  const hub = loadClassroomHub();
  const catalogOrder = catalogOrderFromHub(hub);
  const orderedCourses = classroomCoursesByIds(hub, CLASSROOM_DISPLAY_ORDER);
  const orderedIds = new Set(orderedCourses.map((c) => c.id));
  const coursesForRows = [
    ...orderedCourses,
    ...hub.courses.filter((c) => !orderedIds.has(c.id)),
  ];

  const { data: contentRows, error: contentError } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("course_id, lesson_id, video_url, body_markdown, transcript_text");

  if (contentError) {
    console.error("[lessonImportStatus] academy_lesson_content:", contentError.message);
  }

  const byKey = new Map<string, ContentRow>();
  for (const row of contentRows ?? []) {
    const r = row as ContentRow;
    byKey.set(lessonKey(r.course_id, r.lesson_id), r);
  }

  const lessons: LessonImportStatusRow[] = [];
  for (const course of coursesForRows) {
    collectLessonRows(course, course.sections, byKey, adminBasePath, lessons);
  }

  const summary = {
    lessonCount: lessons.length,
    legacyVideoCount: lessons.filter((l) => l.legacyExpectsVideo).length,
    inAppVideoCount: lessons.filter((l) => l.hasInAppVideo).length,
    missingVideoCount: lessons.filter((l) => l.missingVideo).length,
    missingContentCount: lessons.filter((l) => l.missingContent).length,
    missingTranscriptCount: lessons.filter((l) => l.missingTranscript).length,
    readyCount: lessons.filter(
      (l) =>
        (!l.legacyExpectsVideo || l.hasInAppVideo) &&
        !l.missingContent &&
        !l.missingTranscript,
    ).length,
  };

  const { data: snap } = await supabaseAdmin
    .from("academy_import_snapshot")
    .select("updated_at")
    .eq("id", 1)
    .maybeSingle();

  return {
    lessons,
    courseOrder: coursesForRows.map((c) => c.id),
    catalogOrder,
    summary,
    snapshotUpdatedAt: (snap?.updated_at as string | undefined) ?? null,
  };
}

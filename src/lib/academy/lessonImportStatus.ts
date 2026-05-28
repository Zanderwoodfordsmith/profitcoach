import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { loadLegacyHub } from "./legacyHubLoad";
import type { LegacyHubCourse, LegacyHubLesson } from "./legacyHubCatalog";
import {
  lessonVideoImportStatus,
  type LessonImportCatalogOrder,
  type LessonImportStatusReport,
  type LessonImportStatusRow,
} from "./lessonImportStatusClient";

export type {
  LessonImportCatalogOrder,
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

function catalogOrderFromHub(hub: ReturnType<typeof loadLegacyHub>): LessonImportCatalogOrder {
  return {
    courses: hub.courses.map((course) => ({
      id: course.id,
      title: course.title,
      sections: course.sections.map((section) => ({
        id: section.id,
        title: section.title,
        lessonIds: section.lessons.map((l) => l.id),
      })),
    })),
  };
}

function rowFromLesson(
  course: LegacyHubCourse,
  sectionTitle: string,
  lesson: LegacyHubLesson,
  content: ContentRow | undefined,
  adminBasePath: string
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

export async function loadLessonImportStatusReport(
  adminBasePath = "/admin/academy/programs"
): Promise<LessonImportStatusReport> {
  const hub = loadLegacyHub();
  const catalogOrder = catalogOrderFromHub(hub);

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
  for (const course of hub.courses) {
    for (const section of course.sections) {
      for (const lesson of section.lessons) {
        lessons.push(
          rowFromLesson(
            course,
            section.title,
            lesson,
            byKey.get(lessonKey(course.id, lesson.id)),
            adminBasePath
          )
        );
      }
    }
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
        !l.missingTranscript
    ).length,
  };

  const { data: snap } = await supabaseAdmin
    .from("academy_import_snapshot")
    .select("updated_at")
    .eq("id", 1)
    .maybeSingle();

  return {
    lessons,
    courseOrder: hub.courses.map((c) => c.id),
    catalogOrder,
    summary,
    snapshotUpdatedAt: (snap?.updated_at as string | undefined) ?? null,
  };
}

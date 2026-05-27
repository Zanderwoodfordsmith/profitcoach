/** Client-safe lesson import status helpers (no fs / Supabase). */

export type LessonVideoImportStatus = "video_ready" | "video_missing" | "no_video";

export function lessonVideoImportStatus(row: {
  legacyExpectsVideo: boolean;
  hasInAppVideo: boolean;
}): LessonVideoImportStatus {
  if (!row.legacyExpectsVideo) return "no_video";
  return row.hasInAppVideo ? "video_ready" : "video_missing";
}

export type LessonImportStatusRow = {
  courseId: string;
  courseTitle: string;
  sectionTitle: string;
  lessonId: string;
  lessonTitle: string;
  legacyExpectsVideo: boolean;
  hasInAppVideo: boolean;
  hasTranscript: boolean;
  videoStatus: LessonVideoImportStatus;
  missingVideo: boolean;
  missingTranscript: boolean;
  adminLessonHref: string;
};

export type LessonImportStatusSummary = {
  lessonCount: number;
  legacyVideoCount: number;
  inAppVideoCount: number;
  transcriptCount: number;
  missingVideoCount: number;
  missingTranscriptCount: number;
  readyCount: number;
};

export type LessonImportFilter = "all" | "gaps" | "missingVideo" | "missingTranscript";

export type LessonImportSectionGroup = {
  sectionTitle: string;
  sectionKey: string;
  lessons: LessonImportStatusRow[];
};

export type LessonImportCourseGroup = {
  courseId: string;
  courseTitle: string;
  sections: LessonImportSectionGroup[];
  lessonCount: number;
  gapCount: number;
};

/** Programme / section / lesson order from legacy-hub.json (serializable). */
export type LessonImportCatalogOrder = {
  courses: Array<{
    id: string;
    title: string;
    sections: Array<{ id: string; title: string; lessonIds: string[] }>;
  }>;
};

export type LessonImportStatusReport = {
  lessons: LessonImportStatusRow[];
  courseOrder: string[];
  catalogOrder: LessonImportCatalogOrder;
  summary: LessonImportStatusSummary;
  snapshotUpdatedAt: string | null;
};

export function lessonMatchesImportFilter(
  row: LessonImportStatusRow,
  filter: LessonImportFilter
): boolean {
  switch (filter) {
    case "missingVideo":
      return row.videoStatus === "video_missing";
    case "missingTranscript":
      return row.missingTranscript;
    case "gaps":
      return row.missingVideo || row.missingTranscript;
    default:
      return true;
  }
}

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

/** Build programme → section → lessons tree in legacy-hub catalogue order. */
export function buildOrderedCourseGroups(
  lessons: LessonImportStatusRow[],
  catalogOrder: LessonImportCatalogOrder,
  filter: LessonImportFilter
): LessonImportCourseGroup[] {
  const byKey = new Map<string, LessonImportStatusRow>();
  for (const row of lessons) {
    byKey.set(lessonKey(row.courseId, row.lessonId), row);
  }

  const result: LessonImportCourseGroup[] = [];

  for (const hubCourse of catalogOrder.courses) {
    const sections: LessonImportSectionGroup[] = [];

    for (const section of hubCourse.sections) {
      const sectionLessons: LessonImportStatusRow[] = [];
      for (const lessonId of section.lessonIds) {
        const row = byKey.get(lessonKey(hubCourse.id, lessonId));
        if (row && lessonMatchesImportFilter(row, filter)) {
          sectionLessons.push(row);
        }
      }
      if (sectionLessons.length > 0) {
        sections.push({
          sectionTitle: section.title,
          sectionKey: `${hubCourse.id}:${section.id}`,
          lessons: sectionLessons,
        });
      }
    }

    if (sections.length === 0) continue;

    const lessonCount = sections.reduce((n, s) => n + s.lessons.length, 0);
    const gapCount = sections.reduce(
      (n, s) => n + s.lessons.filter((l) => l.missingVideo || l.missingTranscript).length,
      0
    );

    result.push({
      courseId: hubCourse.id,
      courseTitle: hubCourse.title,
      sections,
      lessonCount,
      gapCount,
    });
  }

  return result;
}

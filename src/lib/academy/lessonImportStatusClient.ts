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
  hasContent: boolean;
  hasTranscript: boolean;
  videoStatus: LessonVideoImportStatus;
  missingVideo: boolean;
  missingContent: boolean;
  missingTranscript: boolean;
  adminLessonHref: string;
};

export type LessonImportStatusSummary = {
  lessonCount: number;
  legacyVideoCount: number;
  inAppVideoCount: number;
  missingVideoCount: number;
  missingContentCount: number;
  missingTranscriptCount: number;
  readyCount: number;
};

export type LessonImportFilter =
  | "all"
  | "gaps"
  | "missingVideo"
  | "missingContent"
  | "missingTranscript";

export type LessonImportSectionGroup = {
  sectionTitle: string;
  sectionKey: string;
  lessons: LessonImportStatusRow[];
  /** Gaps in this module (missing video and/or transcript), regardless of list filter. */
  gapCount: number;
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
    case "missingContent":
      return row.missingContent;
    case "missingTranscript":
      return row.missingTranscript;
    case "gaps":
      return row.missingVideo || row.missingContent || row.missingTranscript;
    default:
      return true;
  }
}

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

function lessonHasGap(row: LessonImportStatusRow): boolean {
  return row.missingVideo || row.missingContent || row.missingTranscript;
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
    let courseGapCount = 0;

    for (const section of hubCourse.sections) {
      const sectionLessons: LessonImportStatusRow[] = [];
      let sectionGapCount = 0;
      for (const lessonId of section.lessonIds) {
        const row = byKey.get(lessonKey(hubCourse.id, lessonId));
        if (!row) continue;
        if (lessonHasGap(row)) {
          sectionGapCount++;
          courseGapCount++;
        }
        if (lessonMatchesImportFilter(row, filter)) {
          sectionLessons.push(row);
        }
      }
      if (sectionLessons.length > 0) {
        sections.push({
          sectionTitle: section.title,
          sectionKey: `${hubCourse.id}:${section.id}`,
          lessons: sectionLessons,
          gapCount: sectionGapCount,
        });
      }
    }

    if (sections.length === 0) continue;

    const lessonCount = sections.reduce((n, s) => n + s.lessons.length, 0);

    result.push({
      courseId: hubCourse.id,
      courseTitle: hubCourse.title,
      sections,
      lessonCount,
      gapCount: courseGapCount,
    });
  }

  return result;
}

export type ImportLinkLessonPickGroup = {
  label: string;
  keys: string[];
};

/** Gap-prioritised lesson lists for linking Drive video/transcript files in the admin import UI. */
export function buildImportLinkLessonPickGroups(
  fileKind: "video" | "transcript",
  catalogOrder: LessonImportCatalogOrder,
  lessonsByKey: ReadonlyMap<string, LessonImportStatusRow>,
  excludeKeys?: ReadonlySet<string>
): ImportLinkLessonPickGroup[] {
  const missingVideoKeys: string[] = [];
  const missingTranscriptKeys: string[] = [];
  const exclude = excludeKeys ?? new Set<string>();

  for (const course of catalogOrder.courses) {
    for (const section of course.sections) {
      for (const lessonId of section.lessonIds) {
        const key = lessonKey(course.id, lessonId);
        if (exclude.has(key)) continue;
        const row = lessonsByKey.get(key);
        if (!row) continue;
        if (row.missingVideo) missingVideoKeys.push(key);
        else if (row.missingTranscript) missingTranscriptKeys.push(key);
      }
    }
  }

  if (fileKind === "video") {
    return [
      missingVideoKeys.length > 0
        ? { label: "Missing video (expected)", keys: missingVideoKeys }
        : null,
      missingTranscriptKeys.length > 0
        ? { label: "Missing transcript", keys: missingTranscriptKeys }
        : null,
    ].filter((g): g is ImportLinkLessonPickGroup => g !== null);
  }

  return [
    missingTranscriptKeys.length > 0
      ? { label: "Missing transcript", keys: missingTranscriptKeys }
      : null,
    missingVideoKeys.length > 0
      ? { label: "Missing video (expected)", keys: missingVideoKeys }
      : null,
  ].filter((g): g is ImportLinkLessonPickGroup => g !== null);
}

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

/** Nested hub section tree (categories can contain sub-sections). */
export type LessonImportCatalogSection = {
  id: string;
  title: string;
  presentation?: "accordion" | "rule";
  lessonIds: string[];
  sections?: LessonImportCatalogSection[];
};

/** Programme / section / lesson order from classroom-hub.json (serializable). */
export type LessonImportCatalogOrder = {
  courses: Array<{
    id: string;
    title: string;
    sections: LessonImportCatalogSection[];
  }>;
};

export type LessonImportSectionGroup = {
  sectionId: string;
  sectionTitle: string;
  sectionKey: string;
  presentation?: "accordion" | "rule";
  lessons: LessonImportStatusRow[];
  sections: LessonImportSectionGroup[];
  /** Gaps in this module + nested children (missing video/content/transcript). */
  gapCount: number;
  /** Visible lessons in this module + nested children (after list filter). */
  lessonCount: number;
};

export type LessonImportCourseGroup = {
  courseId: string;
  courseTitle: string;
  sections: LessonImportSectionGroup[];
  lessonCount: number;
  gapCount: number;
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

function buildSectionGroup(
  courseId: string,
  section: LessonImportCatalogSection,
  byKey: Map<string, LessonImportStatusRow>,
  filter: LessonImportFilter,
): LessonImportSectionGroup | null {
  const lessons: LessonImportStatusRow[] = [];
  let directGapCount = 0;

  for (const lessonId of section.lessonIds) {
    const row = byKey.get(lessonKey(courseId, lessonId));
    if (!row) continue;
    if (lessonHasGap(row)) directGapCount += 1;
    if (lessonMatchesImportFilter(row, filter)) lessons.push(row);
  }

  const childSections: LessonImportSectionGroup[] = [];
  for (const child of section.sections ?? []) {
    const built = buildSectionGroup(courseId, child, byKey, filter);
    if (built) childSections.push(built);
  }

  if (lessons.length === 0 && childSections.length === 0) return null;

  const nestedLessonCount = childSections.reduce((n, s) => n + s.lessonCount, 0);
  const nestedGapCount = childSections.reduce((n, s) => n + s.gapCount, 0);

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    sectionKey: `${courseId}:${section.id}`,
    presentation: section.presentation,
    lessons,
    sections: childSections,
    gapCount: directGapCount + nestedGapCount,
    lessonCount: lessons.length + nestedLessonCount,
  };
}

/** Build programme → category → sub-section → lessons tree in classroom order. */
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
      const built = buildSectionGroup(hubCourse.id, section, byKey, filter);
      if (built) sections.push(built);
    }
    if (sections.length === 0) continue;

    result.push({
      courseId: hubCourse.id,
      courseTitle: hubCourse.title,
      sections,
      lessonCount: sections.reduce((n, s) => n + s.lessonCount, 0),
      gapCount: sections.reduce((n, s) => n + s.gapCount, 0),
    });
  }

  return result;
}

/** Collect every expandable section key in a course tree (for expand-all). */
export function collectSectionKeys(sections: LessonImportSectionGroup[]): string[] {
  const keys: string[] = [];
  for (const section of sections) {
    keys.push(section.sectionKey);
    keys.push(...collectSectionKeys(section.sections));
  }
  return keys;
}

export type ImportLinkLessonPickGroup = {
  label: string;
  keys: string[];
};

function walkCatalogLessonIds(
  courseId: string,
  sections: LessonImportCatalogSection[],
  visit: (courseId: string, lessonId: string) => void,
) {
  for (const section of sections) {
    for (const lessonId of section.lessonIds) visit(courseId, lessonId);
    if (section.sections?.length) {
      walkCatalogLessonIds(courseId, section.sections, visit);
    }
  }
}

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
    walkCatalogLessonIds(course.id, course.sections, (courseId, lessonId) => {
      const key = lessonKey(courseId, lessonId);
      if (exclude.has(key)) return;
      const row = lessonsByKey.get(key);
      if (!row) return;
      if (row.missingVideo) missingVideoKeys.push(key);
      else if (row.missingTranscript) missingTranscriptKeys.push(key);
    });
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

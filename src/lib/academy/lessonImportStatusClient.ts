/** Client-safe lesson import status helpers (no fs / Supabase). */

export type LessonVideoImportStatus = "video_ready" | "video_missing" | "no_video";

export function lessonVideoImportStatus(row: {
  legacyExpectsVideo: boolean;
  hasInAppVideo: boolean;
}): LessonVideoImportStatus {
  if (!row.legacyExpectsVideo) return "no_video";
  return row.hasInAppVideo ? "video_ready" : "video_missing";
}

/** How this row appears in the admin lessons tree. */
export type LessonImportKind = "single" | "chaptered" | "chapter" | "satellite";

export type LessonImportStatusRow = {
  courseId: string;
  courseTitle: string;
  sectionTitle: string;
  lessonId: string;
  lessonTitle: string;
  /** Single hub lesson, chaptered parent, chapter step, or optional satellite. */
  kind: LessonImportKind;
  /** Chapter id when `kind === "chapter"`. */
  chapterId?: string;
  /** Parent hub lesson when `kind` is `chapter` or `satellite`. */
  parentLessonId?: string;
  parentLessonTitle?: string;
  /** Set on chaptered parents. */
  chapterCount?: number;
  /** Set on parents with optional related extras. */
  satelliteCount?: number;
  /** Chapter steps and related satellites nested under a parent lesson. */
  children?: LessonImportStatusRow[];
  legacyExpectsVideo: boolean;
  hasInAppVideo: boolean;
  hasContent: boolean;
  hasTranscript: boolean;
  videoStatus: LessonVideoImportStatus;
  missingVideo: boolean;
  missingContent: boolean;
  missingTranscript: boolean;
  /** True when Classroom treats this lesson as draft (admins only). */
  isDraft: boolean;
  adminLessonHref: string;
  /** Compact duration label (`6m`, `1h 5m`) when known. */
  durationLabel: string | null;
  /** Parsed minutes for aggregation; 0 when unknown. */
  durationMinutes: number;
};

export type LessonImportStatusSummary = {
  lessonCount: number;
  /** Hub lessons only (excludes nested chapters and satellites). */
  hubLessonCount: number;
  chapteredLessonCount: number;
  chapterStepCount: number;
  satelliteCount: number;
  legacyVideoCount: number;
  inAppVideoCount: number;
  missingVideoCount: number;
  missingContentCount: number;
  missingTranscriptCount: number;
  readyCount: number;
  draftCount: number;
  publishedCount: number;
  /** Sum of hub-lesson durations (chaptered parents use rolled-up chapter time). */
  totalDurationMinutes: number;
  totalDurationLabel: string | null;
};

export type LessonImportFilter =
  | "all"
  | "gaps"
  | "missingVideo"
  | "missingContent"
  | "missingTranscript"
  | "draft"
  | "published";

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

/** Per-column ready / missing counts for Content, Video, Transcript. */
export type LessonImportColumnTally = {
  ok: number;
  missing: number;
};

export type LessonImportColumnTallies = {
  content: LessonImportColumnTally;
  video: LessonImportColumnTally;
  transcript: LessonImportColumnTally;
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
  /** Column tallies for visible lessons in this module + nested children. */
  columnTallies: LessonImportColumnTallies;
  /** Sum of hub-lesson durations in this module + nested children. */
  durationMinutes: number;
  durationLabel: string | null;
};

export type LessonImportCourseGroup = {
  courseId: string;
  courseTitle: string;
  sections: LessonImportSectionGroup[];
  lessonCount: number;
  gapCount: number;
  columnTallies: LessonImportColumnTallies;
  durationMinutes: number;
  durationLabel: string | null;
};

export type LessonImportStatusReport = {
  lessons: LessonImportStatusRow[];
  courseOrder: string[];
  catalogOrder: LessonImportCatalogOrder;
  summary: LessonImportStatusSummary;
  snapshotUpdatedAt: string | null;
};

/** Parse hub/DB duration strings like `23m`, `1h 5m`, `(15m)` into minutes. */
export function parseImportDurationMinutes(raw: string | null | undefined): number {
  if (!raw) return 0;
  const t = raw.trim().replace(/^\(|\)$/g, "").trim().toLowerCase();
  if (!t) return 0;
  const hm = t.match(
    /^(\d+(?:\.\d+)?)\s*h(?:r|rs|our|ours)?\s*(\d+(?:\.\d+)?)?\s*m(?:in(?:ute)?s?)?$/,
  );
  if (hm) {
    return Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);
  }
  const hoursOnly = t.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs|our|ours)?$/);
  if (hoursOnly) return Number(hoursOnly[1]) * 60;
  const mins = t.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/);
  if (mins) return Number(mins[1]);
  const bare = Number(t);
  return Number.isFinite(bare) ? bare : 0;
}

/** Format total minutes as `45m` or `1h 16m`. */
export function formatImportDurationMinutes(totalMinutes: number): string | null {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null;
  const rounded = Math.round(totalMinutes);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function resolveImportDuration(raw: string | null | undefined): {
  durationLabel: string | null;
  durationMinutes: number;
} {
  const durationMinutes = parseImportDurationMinutes(raw);
  return {
    durationMinutes,
    durationLabel: formatImportDurationMinutes(durationMinutes),
  };
}

function rowMatchesImportFilterSelf(
  row: LessonImportStatusRow,
  filter: LessonImportFilter,
): boolean {
  switch (filter) {
    case "missingVideo":
      return row.videoStatus === "video_missing";
    case "missingContent":
      return row.missingContent;
    case "missingTranscript":
      return row.missingTranscript;
    case "draft":
      return row.isDraft;
    case "published":
      return !row.isDraft;
    case "gaps":
      return row.missingVideo || row.missingContent || row.missingTranscript;
    default:
      return true;
  }
}

export function lessonMatchesImportFilter(
  row: LessonImportStatusRow,
  filter: LessonImportFilter
): boolean {
  if (rowMatchesImportFilterSelf(row, filter)) return true;
  return row.children?.some((child) => lessonMatchesImportFilter(child, filter)) ?? false;
}

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

function lessonHasGap(row: LessonImportStatusRow): boolean {
  if (row.missingVideo || row.missingContent || row.missingTranscript) return true;
  return row.children?.some(lessonHasGap) ?? false;
}

/** Every row in the tree (parent + nested chapters / satellites). */
export function flattenLessonImportRows(
  rows: LessonImportStatusRow[],
): LessonImportStatusRow[] {
  const out: LessonImportStatusRow[] = [];
  for (const row of rows) {
    out.push(row);
    if (row.children?.length) out.push(...flattenLessonImportRows(row.children));
  }
  return out;
}

export function emptyColumnTallies(): LessonImportColumnTallies {
  return {
    content: { ok: 0, missing: 0 },
    video: { ok: 0, missing: 0 },
    transcript: { ok: 0, missing: 0 },
  };
}

export function addLessonColumnTallies(
  tallies: LessonImportColumnTallies,
  row: LessonImportStatusRow,
): void {
  const rows =
    row.kind === "chaptered" && row.children?.length
      ? row.children
      : [row];

  for (const tallyRow of rows) {
    if (tallyRow.hasContent) tallies.content.ok += 1;
    else tallies.content.missing += 1;

    if (tallyRow.videoStatus === "video_ready") tallies.video.ok += 1;
    else if (tallyRow.videoStatus === "video_missing") tallies.video.missing += 1;

    if (tallyRow.hasInAppVideo) {
      if (tallyRow.hasTranscript) tallies.transcript.ok += 1;
      else tallies.transcript.missing += 1;
    }
  }
}

export function mergeColumnTallies(
  a: LessonImportColumnTallies,
  b: LessonImportColumnTallies,
): LessonImportColumnTallies {
  return {
    content: {
      ok: a.content.ok + b.content.ok,
      missing: a.content.missing + b.content.missing,
    },
    video: {
      ok: a.video.ok + b.video.ok,
      missing: a.video.missing + b.video.missing,
    },
    transcript: {
      ok: a.transcript.ok + b.transcript.ok,
      missing: a.transcript.missing + b.transcript.missing,
    },
  };
}

function visibleImportRowCount(rows: LessonImportStatusRow[]): number {
  let count = 0;
  for (const row of rows) {
    count += 1;
    if (row.children?.length) count += visibleImportRowCount(row.children);
  }
  return count;
}

function talliesFromLessons(lessons: LessonImportStatusRow[]): LessonImportColumnTallies {
  const tallies = emptyColumnTallies();
  for (const row of lessons) addLessonColumnTallies(tallies, row);
  return tallies;
}

/** Hub-lesson duration only (chaptered parents already roll up chapter time). */
function durationMinutesFromHubLessons(lessons: LessonImportStatusRow[]): number {
  return lessons.reduce((sum, row) => sum + (row.durationMinutes || 0), 0);
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
  let columnTallies = talliesFromLessons(lessons);
  for (const child of childSections) {
    columnTallies = mergeColumnTallies(columnTallies, child.columnTallies);
  }

  const durationMinutes =
    durationMinutesFromHubLessons(lessons) +
    childSections.reduce((n, s) => n + s.durationMinutes, 0);

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    sectionKey: `${courseId}:${section.id}`,
    presentation: section.presentation,
    lessons,
    sections: childSections,
    gapCount: directGapCount + nestedGapCount,
    lessonCount: visibleImportRowCount(lessons) + nestedLessonCount,
    columnTallies,
    durationMinutes,
    durationLabel: formatImportDurationMinutes(durationMinutes),
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

    const durationMinutes = sections.reduce((n, s) => n + s.durationMinutes, 0);
    result.push({
      courseId: hubCourse.id,
      courseTitle: hubCourse.title,
      sections,
      lessonCount: sections.reduce((n, s) => n + s.lessonCount, 0),
      gapCount: sections.reduce((n, s) => n + s.gapCount, 0),
      columnTallies: sections.reduce(
        (acc, s) => mergeColumnTallies(acc, s.columnTallies),
        emptyColumnTallies(),
      ),
      durationMinutes,
      durationLabel: formatImportDurationMinutes(durationMinutes),
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
      const linkableRows =
        row.kind === "chaptered"
          ? flattenLessonImportRows(row.children ?? [])
          : flattenLessonImportRows([row]);
      for (const linkRow of linkableRows) {
        if (linkRow.kind === "chaptered") continue;
        const linkKey = lessonKey(linkRow.courseId, linkRow.lessonId);
        if (exclude.has(linkKey)) continue;
        if (linkRow.missingVideo) missingVideoKeys.push(linkKey);
        else if (linkRow.missingTranscript) missingTranscriptKeys.push(linkKey);
      }
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

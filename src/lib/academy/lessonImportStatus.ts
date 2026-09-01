import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
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
  parseLessonVideoChapters,
  type LessonVideoChapterInput,
} from "./lessonVideoChapters";
import {
  formatImportDurationMinutes,
  lessonVideoImportStatus,
  resolveImportDuration,
  type LessonImportCatalogOrder,
  type LessonImportCatalogSection,
  type LessonImportKind,
  type LessonImportStatusReport,
  type LessonImportStatusRow,
  flattenLessonImportRows,
} from "./lessonImportStatusClient";

export type {
  LessonImportCatalogOrder,
  LessonImportCatalogSection,
  LessonImportCourseGroup,
  LessonImportFilter,
  LessonImportKind,
  LessonImportSectionGroup,
  LessonImportStatusReport,
  LessonImportStatusRow,
  LessonImportStatusSummary,
  LessonVideoImportStatus,
} from "./lessonImportStatusClient";

export {
  buildOrderedCourseGroups,
  collectSectionKeys,
  flattenLessonImportRows,
  lessonMatchesImportFilter,
} from "./lessonImportStatusClient";

export { lessonVideoImportStatus } from "./lessonImportStatusClient";

type ContentRow = {
  course_id: string;
  lesson_id: string;
  video_url: string | null;
  body_markdown: string | null;
  transcript_text: string | null;
  guide_markdown: string | null;
  duration: string | null;
  video_chapters: unknown;
  is_draft: boolean | null;
  is_deleted: boolean | null;
};

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

function isDeletedContent(content: ContentRow | undefined): boolean {
  return content?.is_deleted === true;
}

function isDraftLesson(
  hubDraft: boolean | undefined,
  content: ContentRow | undefined,
): boolean {
  if (content?.is_draft === true) return true;
  if (content?.is_draft === false) return false;
  return hubDraft === true;
}

const CLASSROOM_DISPLAY_ORDER = [
  ...CLASSROOM_START_COURSE_IDS,
  ...CLASSROOM_PATH_COURSE_IDS,
] as const;

function catalogSectionFromHub(
  section: HubSection,
  deletedLessonIds: ReadonlySet<string>,
): LessonImportCatalogSection {
  return {
    id: section.id,
    title: section.title,
    presentation: section.presentation,
    lessonIds: section.lessons
      .map((l) => l.id)
      .filter((id) => !deletedLessonIds.has(id)),
    sections: section.sections?.map((child) =>
      catalogSectionFromHub(child, deletedLessonIds),
    ),
  };
}

/** Classroom card order (Start Here → Coach Clients), nested categories preserved. */
function catalogOrderFromHub(
  hub: ReturnType<typeof loadClassroomHub>,
  deletedLessonIds: ReadonlySet<string>,
): LessonImportCatalogOrder {
  const ordered = classroomCoursesByIds(hub, CLASSROOM_DISPLAY_ORDER);
  const orderedIds = new Set(ordered.map((c) => c.id));
  const remainder = hub.courses.filter((c) => !orderedIds.has(c.id));

  return {
    courses: [...ordered, ...remainder].map((course) => ({
      id: course.id,
      title: course.title,
      sections: course.sections.map((section) =>
        catalogSectionFromHub(section, deletedLessonIds),
      ),
    })),
  };
}

function contentForLesson(
  byKey: Map<string, ContentRow>,
  lessonId: string,
): ContentRow | undefined {
  return byKey.get(lessonKey(contentSourceCourseId(lessonId), lessonId));
}

function importStatusFromContent(
  lesson: HubLesson,
  content: ContentRow | undefined,
  options?: {
    kind?: LessonImportKind;
    parentLessonId?: string;
    parentLessonTitle?: string;
    chapterId?: string;
    lessonTitle?: string;
    lessonId?: string;
    adminLessonHref?: string;
    /** Prefer this duration label over content/hub when set (e.g. chapter duration). */
    durationOverride?: string | null;
    /** When false, parent overview body does not count as missing content. */
    trackContent?: boolean;
    /** When false, parent video columns are N/A (video lives in chapters). */
    trackVideo?: boolean;
  },
): Omit<
  LessonImportStatusRow,
  | "courseId"
  | "courseTitle"
  | "sectionTitle"
  | "chapterCount"
  | "satelliteCount"
  | "children"
> {
  const trackContent = options?.trackContent ?? true;
  const trackVideo = options?.trackVideo ?? true;
  const hasInAppVideo = Boolean(content?.video_url?.trim());
  const hasContent = trackContent
    ? Boolean(content?.body_markdown?.trim() || content?.guide_markdown?.trim())
    : true;
  const hasTranscript = Boolean(content?.transcript_text?.trim());
  const legacyExpectsVideo = trackVideo ? lesson.hasVideo : false;
  const missingVideo = trackVideo && legacyExpectsVideo && !hasInAppVideo;
  const missingContent = trackContent && !hasContent;
  // Only a transcript gap when a video exists and has not been transcribed.
  // Expected-but-missing video is a video issue, not a transcript issue.
  const missingTranscript = trackVideo && hasInAppVideo && !hasTranscript;
  const videoStatus = trackVideo
    ? lessonVideoImportStatus({ legacyExpectsVideo, hasInAppVideo })
    : "no_video";
  const durationRaw =
    options?.durationOverride?.trim() ||
    content?.duration?.trim() ||
    lesson.duration?.trim() ||
    null;
  const { durationLabel, durationMinutes } = resolveImportDuration(durationRaw);

  return {
    lessonId: options?.lessonId ?? lesson.id,
    lessonTitle: options?.lessonTitle ?? lesson.title,
    kind: options?.kind ?? "single",
    chapterId: options?.chapterId,
    parentLessonId: options?.parentLessonId,
    parentLessonTitle: options?.parentLessonTitle,
    legacyExpectsVideo,
    hasInAppVideo,
    hasContent,
    hasTranscript,
    videoStatus,
    missingVideo,
    missingContent,
    missingTranscript,
    isDraft: isDraftLesson(lesson.draft, content),
    adminLessonHref: options?.adminLessonHref ?? "",
    durationLabel,
    durationMinutes,
  };
}

function rowFromChapter(
  course: HubCourse,
  sectionTitle: string,
  parentLesson: HubLesson,
  chapter: LessonVideoChapterInput,
  byKey: Map<string, ContentRow>,
  adminBasePath: string,
): LessonImportStatusRow | null {
  const sourceContent = chapter.source_lesson_id
    ? contentForLesson(byKey, chapter.source_lesson_id)
    : undefined;
  const directVideo = chapter.video_url?.trim() || null;
  const sourceVideo = sourceContent?.video_url?.trim() || null;
  const hasResolvableContent =
    Boolean(directVideo || sourceVideo) ||
    Boolean(sourceContent?.guide_markdown?.trim()) ||
    Boolean(sourceContent?.body_markdown?.trim());

  if (!hasResolvableContent) return null;

  const hasChapterVideo = Boolean(directVideo || sourceVideo);
  // Chapter time comes only from the chapter / source lesson — never the parent
  // (parent duration is the sum of chapter times).
  const chapterDuration =
    chapter.duration?.trim() || sourceContent?.duration?.trim() || null;

  const pseudoLesson: HubLesson = {
    ...parentLesson,
    id: chapter.source_lesson_id ?? `${parentLesson.id}#${chapter.id}`,
    title: chapter.title,
    // Chapters are video steps: missing video is a real gap, not inherited N/A.
    hasVideo: true,
    duration: undefined,
  };

  const content: ContentRow | undefined = sourceContent
    ? {
        ...sourceContent,
        video_url: directVideo ?? sourceContent.video_url,
        // Avoid parent fall-through; only this chapter's own duration counts.
        duration: chapterDuration,
      }
    : directVideo
      ? {
          course_id: contentSourceCourseId(parentLesson.id),
          lesson_id: parentLesson.id,
          video_url: directVideo,
          body_markdown: null,
          transcript_text: null,
          guide_markdown: null,
          duration: chapterDuration,
          video_chapters: null,
          is_draft: null,
          is_deleted: null,
        }
      : undefined;

  const base = importStatusFromContent(pseudoLesson, content, {
    kind: "chapter",
    parentLessonId: parentLesson.id,
    parentLessonTitle: parentLesson.title,
    chapterId: chapter.id,
    lessonTitle: chapter.title,
    lessonId: chapter.source_lesson_id ?? `${parentLesson.id}#${chapter.id}`,
    adminLessonHref: `${adminBasePath}/${course.id}/${parentLesson.id}?chapter=${encodeURIComponent(chapter.id)}`,
    // Only show time when this chapter actually has a video.
    durationOverride: hasChapterVideo ? chapterDuration : null,
  });

  return {
    ...base,
    // No video → no time (don't keep a duration label from stray source data).
    ...(hasChapterVideo
      ? {}
      : { durationLabel: null, durationMinutes: 0 }),
    isDraft: isDraftLesson(undefined, content),
    courseId: course.id,
    courseTitle: course.title,
    sectionTitle,
  };
}

function rowFromSatellite(
  course: HubCourse,
  sectionTitle: string,
  parentLesson: HubLesson,
  satellite: HubLesson,
  byKey: Map<string, ContentRow>,
  adminBasePath: string,
): LessonImportStatusRow {
  const content = contentForLesson(byKey, satellite.id);
  const base = importStatusFromContent(satellite, content, {
    kind: "satellite",
    parentLessonId: parentLesson.id,
    parentLessonTitle: parentLesson.title,
    adminLessonHref: `${adminBasePath}/${course.id}/${satellite.id}`,
  });

  return {
    ...base,
    courseId: course.id,
    courseTitle: course.title,
    sectionTitle,
  };
}

function rowFromLesson(
  course: HubCourse,
  sectionTitle: string,
  lesson: HubLesson,
  content: ContentRow | undefined,
  byKey: Map<string, ContentRow>,
  adminBasePath: string,
): LessonImportStatusRow {
  const chapterInputs = parseLessonVideoChapters(content?.video_chapters);
  const chapterChildren = chapterInputs
    .map((chapter) =>
      rowFromChapter(course, sectionTitle, lesson, chapter, byKey, adminBasePath),
    )
    .filter((row): row is LessonImportStatusRow => row !== null);
  const satelliteChildren = (lesson.satellites ?? []).map((satellite) =>
    rowFromSatellite(course, sectionTitle, lesson, satellite, byKey, adminBasePath),
  );
  const children = [...chapterChildren, ...satelliteChildren];
  const isChaptered = chapterChildren.length > 0;

  const base = importStatusFromContent(lesson, content, {
    kind: isChaptered ? "chaptered" : "single",
    adminLessonHref: `${adminBasePath}/${course.id}/${lesson.id}`,
    // Overview lives in chapters / related for chaptered lessons.
    trackContent: !isChaptered,
    trackVideo: !isChaptered,
  });

  // Chaptered parents roll up time from chapters that have video (+ duration).
  let durationLabel = base.durationLabel;
  let durationMinutes = base.durationMinutes;
  if (isChaptered) {
    durationMinutes = chapterChildren.reduce(
      (sum, child) => sum + (child.durationMinutes || 0),
      0,
    );
    durationLabel = formatImportDurationMinutes(durationMinutes);
  }

  return {
    ...base,
    durationLabel,
    durationMinutes,
    courseId: course.id,
    courseTitle: course.title,
    sectionTitle,
    chapterCount: chapterChildren.length || undefined,
    satelliteCount: satelliteChildren.length || undefined,
    children: children.length > 0 ? children : undefined,
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
      const content = contentForLesson(byKey, lesson.id);
      if (isDeletedContent(content)) continue;
      out.push(
        rowFromLesson(course, section.title, lesson, content, byKey, adminBasePath),
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
  const orderedCourses = classroomCoursesByIds(hub, CLASSROOM_DISPLAY_ORDER);
  const orderedIds = new Set(orderedCourses.map((c) => c.id));
  const coursesForRows = [
    ...orderedCourses,
    ...hub.courses.filter((c) => !orderedIds.has(c.id)),
  ];

  const { data: contentRows, error: contentError } = await supabaseAdmin
    .from("academy_lesson_content")
    .select(
      "course_id, lesson_id, video_url, body_markdown, transcript_text, guide_markdown, duration, video_chapters, is_draft, is_deleted",
    );

  if (contentError) {
    console.error("[lessonImportStatus] academy_lesson_content:", contentError.message);
  }

  const byKey = new Map<string, ContentRow>();
  const deletedLessonIds = new Set<string>();
  for (const row of contentRows ?? []) {
    const r = row as ContentRow;
    byKey.set(lessonKey(r.course_id, r.lesson_id), r);
    if (r.is_deleted === true) deletedLessonIds.add(r.lesson_id);
  }

  const catalogOrder = catalogOrderFromHub(hub, deletedLessonIds);

  const lessons: LessonImportStatusRow[] = [];
  for (const course of coursesForRows) {
    collectLessonRows(course, course.sections, byKey, adminBasePath, lessons);
  }

  const flatLessons = flattenLessonImportRows(lessons);
  const totalDurationMinutes = lessons.reduce(
    (sum, row) => sum + (row.durationMinutes || 0),
    0,
  );

  const summary = {
    lessonCount: flatLessons.length,
    hubLessonCount: lessons.length,
    chapteredLessonCount: lessons.filter((l) => l.kind === "chaptered").length,
    chapterStepCount: flatLessons.filter((l) => l.kind === "chapter").length,
    satelliteCount: flatLessons.filter((l) => l.kind === "satellite").length,
    legacyVideoCount: flatLessons.filter((l) => l.legacyExpectsVideo).length,
    inAppVideoCount: flatLessons.filter((l) => l.hasInAppVideo).length,
    missingVideoCount: flatLessons.filter((l) => l.missingVideo).length,
    missingContentCount: flatLessons.filter((l) => l.missingContent).length,
    missingTranscriptCount: flatLessons.filter((l) => l.missingTranscript).length,
    readyCount: flatLessons.filter(
      (l) =>
        (!l.legacyExpectsVideo || l.hasInAppVideo) &&
        !l.missingContent &&
        !l.missingTranscript,
    ).length,
    draftCount: flatLessons.filter((l) => l.isDraft).length,
    publishedCount: flatLessons.filter((l) => !l.isDraft).length,
    totalDurationMinutes,
    totalDurationLabel: formatImportDurationMinutes(totalDurationMinutes),
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

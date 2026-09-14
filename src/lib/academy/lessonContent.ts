import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { AcademyCatalog, AcademyLesson } from "./types";
import type { HubCourse, HubLesson, HubSection } from "./hubCatalog";
import { flattenSections, lessonWithSatellites } from "./hubCatalog";
import { loadAcademyCatalog, loadAcademyCatalogSync } from "./compassCatalog";
import {
  parseRecommendedActions,
  type AcademyRecommendedAction,
} from "./lessonActions";
import {
  hasInAppLessonContent,
  type LessonInAppContent,
} from "./lessonContentUtils";
import {
  parseLessonVideoChapters,
  resolveLessonVideoChapters,
} from "./lessonVideoChapters";
import consolidatedLessonRegistry from "./consolidatedLessonRegistry.json";
import { classroomLessonIdLookupKeys } from "./classroomIdAliases";
import { contentSourceCourseId } from "./programmeContentSource";
import {
  applyCatalogVisibility,
  applyLegacyCourseVisibility,
  type LessonVisibilityOptions,
} from "./lessonVisibility";

export type { LessonInAppContent } from "./lessonContentUtils";
export { hasInAppLessonContent } from "./lessonContentUtils";
export type { LessonVideoChapter } from "./lessonVideoChapters";
export type { AcademyRecommendedAction } from "./lessonActions";

export type AcademyLessonContentRow = {
  course_id: string;
  lesson_id: string;
  title: string | null;
  video_url: string | null;
  audio_url: string | null;
  body_markdown: string | null;
  guide_markdown: string | null;
  transcript_text: string | null;
  /** Display length for the sidebar, e.g. `6m`. */
  duration: string | null;
  recommended_actions?: unknown;
  is_draft?: boolean | null;
  is_deleted?: boolean | null;
  video_chapters?: unknown;
  updated_at: string;
};

export type LoadClassroomCourseOptions = LessonVisibilityOptions & {
  /**
   * When set, only this lesson (and its chapter source rows) get body,
   * transcript, and chapter payloads. Sidebar lessons stay metadata-only.
   */
  activeLessonId?: string;
};

const LESSON_METADATA_COLUMNS =
  "course_id, lesson_id, title, duration, video_url, is_draft, is_deleted, updated_at";

const LESSON_FULL_COLUMNS =
  "course_id, lesson_id, title, video_url, audio_url, body_markdown, guide_markdown, transcript_text, duration, recommended_actions, is_draft, is_deleted, video_chapters, updated_at";

const LESSON_CONTENT_MAP_TTL_MS = 10 * 60 * 1000;

function chapterSourceCourseIds(
  rows: AcademyLessonContentRow[],
  primaryCourseId: string,
  primaryLessonId?: string
): string[] {
  const ids = new Set<string>([primaryCourseId]);
  if (primaryLessonId) {
    ids.add(contentSourceCourseId(primaryLessonId));
  }
  for (const row of rows) {
    for (const chapter of parseLessonVideoChapters(row.video_chapters)) {
      if (chapter.source_lesson_id) {
        ids.add(contentSourceCourseId(chapter.source_lesson_id));
      }
    }
  }
  return [...ids];
}

function classroomSourceCourseIds(course: HubCourse): string[] {
  return [
    ...new Set(
      flattenSections(course.sections).flatMap((section) =>
        section.lessons.flatMap((lesson) =>
          lessonWithSatellites(lesson).flatMap((l) =>
            classroomLessonIdLookupKeys(l.id).map((id) => contentSourceCourseId(id))
          )
        )
      )
    ),
  ];
}

function indexLessonContentRows(
  byLesson: Map<string, AcademyLessonContentRow>,
  incoming: AcademyLessonContentRow[]
) {
  for (const row of incoming) {
    const expected = contentSourceCourseId(row.lesson_id);
    const legacyKeys = classroomLessonIdLookupKeys(row.lesson_id);
    const expectedSet = new Set(
      legacyKeys.map((id) => contentSourceCourseId(id)).concat(expected)
    );
    if (!expectedSet.has(row.course_id)) continue;
    for (const key of legacyKeys) {
      if (!byLesson.has(key)) byLesson.set(key, row);
    }
    byLesson.set(row.lesson_id, row);
  }
}

async function fetchLessonContentRows(
  columns: string,
  courseIds: string[],
  lessonIds?: string[]
): Promise<AcademyLessonContentRow[]> {
  if (courseIds.length === 0) return [];
  if (lessonIds && lessonIds.length === 0) return [];
  let query = supabaseAdmin
    .from("academy_lesson_content")
    .select(columns)
    .in("course_id", courseIds);
  if (lessonIds) {
    query = query.in("lesson_id", lessonIds);
  }
  const { data } = await query;
  return ((data ?? []) as unknown) as AcademyLessonContentRow[];
}

type MetadataCacheEntry = {
  rows: AcademyLessonContentRow[];
  expiresAt: number;
};

const classroomMetadataCache = new Map<string, MetadataCacheEntry>();
const classroomMetadataInflight = new Map<
  string,
  Promise<AcademyLessonContentRow[]>
>();

function classroomMetadataCacheKey(sourceIds: string[]): string {
  return [...sourceIds].sort().join("|");
}

function invalidateClassroomContentCaches() {
  classroomMetadataCache.clear();
  classroomMetadataInflight.clear();
  lessonContentMapCache = null;
}

async function fetchClassroomMetadataRows(
  cacheKey: string
): Promise<AcademyLessonContentRow[]> {
  const sourceIds = cacheKey.split("|").filter(Boolean);
  const now = Date.now();
  const hit = classroomMetadataCache.get(cacheKey);
  if (hit && hit.expiresAt > now) return hit.rows;
  const pending = classroomMetadataInflight.get(cacheKey);
  if (pending) return pending;
  const request = fetchLessonContentRows(LESSON_METADATA_COLUMNS, sourceIds)
    .then((rows) => {
      classroomMetadataCache.set(cacheKey, {
        rows,
        expiresAt: Date.now() + LESSON_CONTENT_MAP_TTL_MS,
      });
      return rows;
    })
    .finally(() => {
      classroomMetadataInflight.delete(cacheKey);
    });
  classroomMetadataInflight.set(cacheKey, request);
  return request;
}

export async function warmupClassroomCourseMetadata(
  course: HubCourse
): Promise<void> {
  const sourceIds = classroomSourceCourseIds(course);
  if (sourceIds.length === 0) return;
  await fetchClassroomMetadataRows(classroomMetadataCacheKey(sourceIds));
}

function slimInactiveLesson(
  lesson: HubLesson,
  keepIds: Set<string>
): HubLesson {
  const satellites = lesson.satellites?.map((sat) =>
    slimInactiveLesson(sat, keepIds)
  );
  if (keepIds.has(lesson.id)) {
    return satellites ? { ...lesson, satellites } : lesson;
  }
  const slim: HubLesson = {
    id: lesson.id,
    title: lesson.title,
    duration: lesson.duration,
    hasVideo: lesson.hasVideo || Boolean(lesson.videoUrl),
    academyUrl: lesson.academyUrl,
  };
  if (lesson.description) slim.description = lesson.description;
  if (lesson.notice) slim.notice = lesson.notice;
  if (lesson.draft !== undefined) slim.draft = lesson.draft;
  if (satellites) slim.satellites = satellites;
  return slim;
}

/** Drop markdown / transcripts from lessons the player is not showing. */
export function stripInactiveLessonBodies(
  course: HubCourse,
  activeLessonId: string
): HubCourse {
  const keepIds = new Set<string>([activeLessonId]);
  return {
    ...course,
    sections: course.sections.map((section) => {
      const slimSection = (node: HubSection): HubSection => ({
        ...node,
        lessons: node.lessons.map((lesson) => slimInactiveLesson(lesson, keepIds)),
        sections: node.sections?.map(slimSection),
      });
      return slimSection(section);
    }),
  };
}

async function loadLessonContentRowsForCourses(
  courseIds: string[]
): Promise<Map<string, AcademyLessonContentRow>> {
  const byLesson = new Map<string, AcademyLessonContentRow>();
  for (const courseId of courseIds) {
    const { data } = await supabaseAdmin
      .from("academy_lesson_content")
      .select("*")
      .eq("course_id", courseId);
    for (const row of data ?? []) {
      const r = row as AcademyLessonContentRow;
      byLesson.set(r.lesson_id, r);
    }
  }
  return byLesson;
}

function titleFromRow(row: AcademyLessonContentRow | null | undefined): string | null {
  const t = row?.title?.trim();
  return t || null;
}

function transcriptFromRow(row: AcademyLessonContentRow | null | undefined): string | null {
  const t = row?.transcript_text?.trim();
  return t || null;
}

function durationFromRow(row: AcademyLessonContentRow | null | undefined): string | null {
  const t = row?.duration?.trim();
  return t || null;
}

/** Normalize editor input like `6`, `6m`, `(6m)` → `6m`. Empty clears override. */
export function normalizeLessonDurationInput(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  let t = raw.trim().replace(/^\(|\)$/g, "").trim().toLowerCase();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) t = `${t}m`;
  return t;
}

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

function recommendedActionsFromRow(
  row: AcademyLessonContentRow | null | undefined
): AcademyRecommendedAction[] {
  return parseRecommendedActions(row?.recommended_actions);
}

function lessonContentFromRow(
  row: AcademyLessonContentRow | null | undefined,
  lookupSource?: (lessonId: string) => AcademyLessonContentRow | null | undefined
): LessonInAppContent | null {
  if (!row) return null;
  const videoUrl = row.video_url;
  const audioUrl = row.audio_url;
  const bodyMarkdown = row.body_markdown ?? "";
  const guideMarkdown = row.guide_markdown ?? "";
  const transcriptText = transcriptFromRow(row);
  const recommendedActions = recommendedActionsFromRow(row);
  const videoChapters = resolveLessonVideoChapters(row.video_chapters, (lessonId) =>
    lookupSource?.(lessonId)
  );
  if (
    !hasInAppLessonContent(
      videoUrl,
      bodyMarkdown,
      transcriptText,
      guideMarkdown,
      audioUrl,
      videoChapters
    ) &&
    recommendedActions.length === 0
  ) {
    return null;
  }
  return {
    videoUrl: videoUrl?.trim() || null,
    audioUrl: audioUrl?.trim() || null,
    bodyMarkdown,
    guideMarkdown,
    transcriptText,
    recommendedActions,
    videoChapters,
  };
}

function draftFromRow(
  baseDraft: boolean | undefined,
  row: AcademyLessonContentRow | null | undefined
): boolean {
  if (row?.is_draft === true) return true;
  if (row?.is_draft === false) return false;
  return baseDraft === true;
}

function isDeletedRow(row: AcademyLessonContentRow | null | undefined): boolean {
  return row?.is_deleted === true;
}

function mergeLesson(base: AcademyLesson, row: AcademyLessonContentRow | undefined): AcademyLesson {
  if (!row) return base;
  if (isDeletedRow(row)) {
    return { ...base, draft: draftFromRow(base.draft, row) };
  }
  const titleOverride = titleFromRow(row);
  const durationOverride = durationFromRow(row);
  const content = lessonContentFromRow(row);
  return {
    ...base,
    ...(titleOverride ? { title: titleOverride } : {}),
    ...(durationOverride ? { duration: durationOverride } : {}),
    videoUrl: row.video_url,
    audioUrl: row.audio_url,
    bodyMarkdown: row.body_markdown ?? "",
    guideMarkdown: content?.guideMarkdown ?? row.guide_markdown ?? "",
    recommendedActions:
      content?.recommendedActions ?? recommendedActionsFromRow(row),
    transcriptText: content?.transcriptText ?? null,
    draft: draftFromRow(base.draft, row),
  };
}

export function mergeLegacyLesson(
  base: HubLesson,
  row: AcademyLessonContentRow | null | undefined,
  lookupSource?: (lessonId: string) => AcademyLessonContentRow | null | undefined
): HubLesson & LessonInAppContent {
  const titleOverride = titleFromRow(row ?? undefined);
  const durationOverride = durationFromRow(row ?? undefined);
  const draft = draftFromRow(base.draft, row);
  const merged = {
    ...base,
    ...(titleOverride ? { title: titleOverride } : {}),
    ...(durationOverride ? { duration: durationOverride } : {}),
    draft,
  };
  const content = lessonContentFromRow(row ?? undefined, lookupSource);
  if (!content) {
    return {
      ...merged,
      videoUrl: null,
      audioUrl: null,
      bodyMarkdown: base.bodyMarkdown ?? "",
      guideMarkdown: base.guideMarkdown ?? "",
      recommendedActions: base.recommendedActions ?? [],
      transcriptText: null,
      videoChapters: [],
    };
  }
  return {
    ...merged,
    ...content,
    draft,
    // Keep hub/catalog body when DB row has media but empty markdown.
    bodyMarkdown: content.bodyMarkdown.trim()
      ? content.bodyMarkdown
      : (base.bodyMarkdown ?? ""),
    guideMarkdown: content.guideMarkdown.trim()
      ? content.guideMarkdown
      : (base.guideMarkdown ?? ""),
    recommendedActions: content.recommendedActions.length
      ? content.recommendedActions
      : (base.recommendedActions ?? []),
  };
}

function mergeLegacySectionTree(
  section: HubSection,
  byLesson: Map<string, AcademyLessonContentRow>
): HubSection {
  const lookupSource = (lessonId: string) => byLesson.get(lessonId);
  return {
    ...section,
    lessons: section.lessons.flatMap((lesson) => {
      const row = byLesson.get(lesson.id);
      if (isDeletedRow(row)) return [];
      const merged = mergeLegacyLesson(lesson, row, lookupSource);
      if (!lesson.satellites?.length) return [merged];
      return [
        {
          ...merged,
          satellites: lesson.satellites.flatMap((sat) => {
            const satRow = byLesson.get(sat.id);
            if (isDeletedRow(satRow)) return [];
            return [mergeLegacyLesson(sat, satRow, lookupSource)];
          }),
        },
      ];
    }),
    sections: section.sections?.map((child) =>
      mergeLegacySectionTree(child, byLesson)
    ),
  };
}

/** Legacy programme course with per-lesson DB overrides (titles, video, body, transcript). */
export async function loadLegacyCourseWithContent(
  course: HubCourse,
  options: LessonVisibilityOptions = {}
): Promise<HubCourse> {
  const { data: rows } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("*")
    .eq("course_id", course.id);

  const courseRows = (rows ?? []) as AcademyLessonContentRow[];
  const byLesson = new Map<string, AcademyLessonContentRow>();
  for (const row of courseRows) {
    byLesson.set(row.lesson_id, row);
  }

  const extraCourseIds = chapterSourceCourseIds(courseRows, course.id).filter(
    (id) => id !== course.id
  );
  if (extraCourseIds.length > 0) {
    const extraRows = await loadLessonContentRowsForCourses(extraCourseIds);
    for (const [lessonId, row] of extraRows) {
      if (!byLesson.has(lessonId)) byLesson.set(lessonId, row);
    }
  }

  const merged: HubCourse = {
    ...course,
    sections: course.sections.map((section) =>
      mergeLegacySectionTree(section, byLesson)
    ),
  };
  return applyLegacyCourseVisibility(merged, options);
}

/**
 * Simplified hub courses may mix lessons from multiple Current programmes
 * (e.g. Client Delivery onboarding + Profit Coach Certification). Resolve
 * content via each lesson's original source course id.
 *
 * Pass `activeLessonId` on the Classroom hot path so inactive lessons stay
 * titles/durations only — no markdown or transcripts over the wire.
 */
export async function loadClassroomCourseWithContent(
  course: HubCourse,
  options: LoadClassroomCourseOptions = {}
): Promise<HubCourse> {
  const sourceIds = classroomSourceCourseIds(course);
  if (sourceIds.length === 0) {
    const empty = applyLegacyCourseVisibility(course, options);
    return options.activeLessonId
      ? stripInactiveLessonBodies(empty, options.activeLessonId)
      : empty;
  }

  const byLesson = new Map<string, AcademyLessonContentRow>();
  const metadataRows = await fetchClassroomMetadataRows(
    classroomMetadataCacheKey(sourceIds)
  );
  indexLessonContentRows(byLesson, metadataRows);

  const activeLessonId = options.activeLessonId?.trim() || null;
  if (activeLessonId) {
    const activeKeys = classroomLessonIdLookupKeys(activeLessonId);
    const activeSourceIds = [
      ...new Set(activeKeys.map((id) => contentSourceCourseId(id))),
    ];
    const fullRows = await fetchLessonContentRows(
      LESSON_FULL_COLUMNS,
      activeSourceIds,
      activeKeys
    );
    indexLessonContentRows(byLesson, fullRows);

    const extraLessonIds = [
      ...new Set(
        fullRows.flatMap((row) =>
          parseLessonVideoChapters(row.video_chapters)
            .map((chapter) => chapter.source_lesson_id)
            .filter((id): id is string => Boolean(id))
        )
      ),
    ].filter((id) => !activeKeys.includes(id));
    if (extraLessonIds.length > 0) {
      const extraCourseIds = [
        ...new Set(extraLessonIds.map((id) => contentSourceCourseId(id))),
      ];
      const extraRows = await fetchLessonContentRows(
        LESSON_FULL_COLUMNS,
        extraCourseIds,
        extraLessonIds
      );
      indexLessonContentRows(byLesson, extraRows);
    }
  } else {
    const fullRows = await fetchLessonContentRows(LESSON_FULL_COLUMNS, sourceIds);
    indexLessonContentRows(byLesson, fullRows);
    const extraCourseIds = [
      ...new Set(
        [...byLesson.values()].flatMap((row) =>
          chapterSourceCourseIds([row], row.course_id).filter(
            (id) => !sourceIds.includes(id)
          )
        )
      ),
    ];
    if (extraCourseIds.length > 0) {
      const extraRows = await fetchLessonContentRows(
        LESSON_FULL_COLUMNS,
        extraCourseIds
      );
      indexLessonContentRows(byLesson, extraRows);
    }
  }

  const merged: HubCourse = {
    ...course,
    sections: course.sections.map((section) =>
      mergeLegacySectionTree(section, byLesson)
    ),
  };
  const visible = applyLegacyCourseVisibility(merged, options);
  return activeLessonId ? stripInactiveLessonBodies(visible, activeLessonId) : visible;
}

async function fetchLessonContentMapUncached(): Promise<
  Map<string, AcademyLessonContentRow>
> {
  const { data: rows } = await supabaseAdmin
    .from("academy_lesson_content")
    .select(
      "course_id, lesson_id, title, video_url, audio_url, body_markdown, guide_markdown, transcript_text, duration, recommended_actions, is_draft, is_deleted, video_chapters, updated_at"
    );
  const map = new Map<string, AcademyLessonContentRow>();
  for (const row of rows ?? []) {
    const r = row as AcademyLessonContentRow;
    map.set(lessonKey(r.course_id, r.lesson_id), r);
  }
  return map;
}

let lessonContentMapCache:
  | { map: Map<string, AcademyLessonContentRow>; expiresAt: number }
  | null = null;

function invalidateLessonContentMapCache() {
  invalidateClassroomContentCaches();
}

async function fetchLessonContentMap(): Promise<Map<string, AcademyLessonContentRow>> {
  const now = Date.now();
  if (lessonContentMapCache && lessonContentMapCache.expiresAt > now) {
    return lessonContentMapCache.map;
  }
  const map = await fetchLessonContentMapUncached();
  lessonContentMapCache = {
    map,
    expiresAt: now + LESSON_CONTENT_MAP_TTL_MS,
  };
  return map;
}

function applyLessonContentToCatalog(
  catalog: AcademyCatalog,
  byKey: Map<string, AcademyLessonContentRow>
): AcademyCatalog {
  return {
    ...catalog,
    categories: (catalog.categories ?? []).map((category) => ({
      ...category,
      courses: (category.courses ?? []).map((course) => ({
        ...course,
        lessons: (course.lessons ?? []).flatMap((lesson) => {
          const row = byKey.get(lessonKey(course.id, lesson.id));
          if (isDeletedRow(row)) return [];
          return [mergeLesson(lesson, row)];
        }),
      })),
    })),
  };
}

/** Catalog with DB lesson overrides merged in. */
export async function loadAcademyCatalogWithDb(
  options: LessonVisibilityOptions = {}
): Promise<AcademyCatalog> {
  const catalog = await loadAcademyCatalog();
  const byKey = await fetchLessonContentMap();
  return applyCatalogVisibility(applyLessonContentToCatalog(catalog, byKey), options);
}

export function loadAcademyCatalogWithDbSync(): AcademyCatalog {
  const catalog = loadAcademyCatalogSync();
  // Sync path skips DB (used only where async is unavailable); callers should prefer async.
  return catalog;
}

export async function loadAcademyLessonContentRow(
  courseId: string,
  lessonId: string
): Promise<AcademyLessonContentRow | null> {
  const { data } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("*")
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  return (data as AcademyLessonContentRow | null) ?? null;
}

export async function loadLegacyLessonWithContent(
  courseId: string,
  lessonId: string,
  base: HubLesson
): Promise<HubLesson & LessonInAppContent> {
  const row = await loadAcademyLessonContentRow(courseId, lessonId);
  const seedRows = row ? [row] : [];
  const courseIds = chapterSourceCourseIds(seedRows, courseId, lessonId);
  const byLesson = await loadLessonContentRowsForCourses(courseIds);
  const lookupSource = (id: string) => byLesson.get(id);
  return mergeLegacyLesson(base, row, lookupSource);
}

export async function upsertAcademyLessonContent(input: {
  courseId: string;
  lessonId: string;
  title?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  bodyMarkdown?: string | null;
  guideMarkdown?: string | null;
  transcriptText?: string | null;
  duration?: string | null;
  recommendedActions?: AcademyRecommendedAction[] | null;
  isDraft?: boolean;
  isDeleted?: boolean;
}): Promise<AcademyLessonContentRow | null> {
  const existing = await loadAcademyLessonContentRow(input.courseId, input.lessonId);

  const row = {
    course_id: input.courseId,
    lesson_id: input.lessonId,
    title:
      input.title !== undefined
        ? input.title?.trim() || null
        : (existing?.title ?? null),
    video_url:
      input.videoUrl !== undefined ? input.videoUrl : (existing?.video_url ?? null),
    audio_url:
      input.audioUrl !== undefined ? input.audioUrl : (existing?.audio_url ?? null),
    body_markdown:
      input.bodyMarkdown !== undefined
        ? input.bodyMarkdown
        : (existing?.body_markdown ?? null),
    guide_markdown:
      input.guideMarkdown !== undefined
        ? input.guideMarkdown
        : (existing?.guide_markdown ?? null),
    transcript_text:
      input.transcriptText !== undefined
        ? input.transcriptText?.trim() || null
        : (existing?.transcript_text ?? null),
    duration:
      input.duration !== undefined
        ? normalizeLessonDurationInput(input.duration)
        : (existing?.duration ?? null),
    recommended_actions:
      input.recommendedActions !== undefined
        ? parseRecommendedActions(input.recommendedActions ?? [])
        : parseRecommendedActions(existing?.recommended_actions),
    is_draft:
      input.isDraft !== undefined ? input.isDraft : (existing?.is_draft ?? false),
    is_deleted:
      input.isDeleted !== undefined
        ? input.isDeleted
        : (existing?.is_deleted ?? false),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("academy_lesson_content")
    .upsert(row, { onConflict: "course_id,lesson_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message ?? "Failed to save lesson content.");
  }
  invalidateLessonContentMapCache();
  return data as AcademyLessonContentRow;
}

/** Set draft and/or soft-delete without clearing other content fields. */
export async function setAcademyLessonVisibility(input: {
  courseId: string;
  lessonId: string;
  isDraft?: boolean;
  isDeleted?: boolean;
}): Promise<AcademyLessonContentRow | null> {
  return upsertAcademyLessonContent({
    courseId: input.courseId,
    lessonId: input.lessonId,
    isDraft: input.isDraft,
    isDeleted: input.isDeleted,
  });
}

export async function findMergedLesson(
  catalog: AcademyCatalog,
  courseId: string,
  lessonId: string
): Promise<AcademyLesson | null> {
  const found = catalog.categories
    ?.flatMap((c) => c.courses ?? [])
    .find((c) => c.id === courseId);
  const base = found?.lessons?.find((l) => l.id === lessonId);
  if (!base) return null;
  const row = await loadAcademyLessonContentRow(courseId, lessonId);
  return mergeLesson(base, row ?? undefined);
}

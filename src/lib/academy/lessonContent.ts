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
import { contentSourceCourseId } from "./programmeContentSource";
import {
  applyCatalogVisibility,
  applyLegacyCourseVisibility,
  type LessonVisibilityOptions,
} from "./lessonVisibility";

export type { LessonInAppContent } from "./lessonContentUtils";
export { hasInAppLessonContent } from "./lessonContentUtils";
export type { AcademyRecommendedAction } from "./lessonActions";

export type AcademyLessonContentRow = {
  course_id: string;
  lesson_id: string;
  title: string | null;
  video_url: string | null;
  body_markdown: string | null;
  guide_markdown: string | null;
  transcript_text: string | null;
  /** Display length for the sidebar, e.g. `6m`. */
  duration: string | null;
  recommended_actions?: unknown;
  is_draft?: boolean | null;
  is_deleted?: boolean | null;
  updated_at: string;
};

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
  row: AcademyLessonContentRow | null | undefined
): LessonInAppContent | null {
  if (!row) return null;
  const videoUrl = row.video_url;
  const bodyMarkdown = row.body_markdown ?? "";
  const guideMarkdown = row.guide_markdown ?? "";
  const transcriptText = transcriptFromRow(row);
  const recommendedActions = recommendedActionsFromRow(row);
  if (
    !hasInAppLessonContent(videoUrl, bodyMarkdown, transcriptText, guideMarkdown) &&
    recommendedActions.length === 0
  ) {
    return null;
  }
  return {
    videoUrl: videoUrl?.trim() || null,
    bodyMarkdown,
    guideMarkdown,
    transcriptText,
    recommendedActions,
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
  row: AcademyLessonContentRow | null | undefined
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
  const content = lessonContentFromRow(row ?? undefined);
  if (!content) {
    return {
      ...merged,
      videoUrl: null,
      bodyMarkdown: base.bodyMarkdown ?? "",
      guideMarkdown: base.guideMarkdown ?? "",
      recommendedActions: base.recommendedActions ?? [],
      transcriptText: null,
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
  return {
    ...section,
    lessons: section.lessons.flatMap((lesson) => {
      const row = byLesson.get(lesson.id);
      if (isDeletedRow(row)) return [];
      const merged = mergeLegacyLesson(lesson, row);
      if (!lesson.satellites?.length) return [merged];
      return [
        {
          ...merged,
          satellites: lesson.satellites.flatMap((sat) => {
            const satRow = byLesson.get(sat.id);
            if (isDeletedRow(satRow)) return [];
            return [mergeLegacyLesson(sat, satRow)];
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

  const byLesson = new Map<string, AcademyLessonContentRow>();
  for (const row of rows ?? []) {
    const r = row as AcademyLessonContentRow;
    byLesson.set(r.lesson_id, r);
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
 */
export async function loadClassroomCourseWithContent(
  course: HubCourse,
  options: LessonVisibilityOptions = {}
): Promise<HubCourse> {
  const sourceIds = [
    ...new Set(
      flattenSections(course.sections).flatMap((section) =>
        section.lessons.flatMap((lesson) =>
          lessonWithSatellites(lesson).map((l) => contentSourceCourseId(l.id))
        )
      )
    ),
  ];
  if (sourceIds.length === 0) {
    return applyLegacyCourseVisibility(course, options);
  }

  const { data: rows } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("*")
    .in("course_id", sourceIds);

  const byLesson = new Map<string, AcademyLessonContentRow>();
  for (const row of rows ?? []) {
    const r = row as AcademyLessonContentRow;
    const expected = contentSourceCourseId(r.lesson_id);
    if (r.course_id !== expected) continue;
    byLesson.set(r.lesson_id, r);
  }

  const merged: HubCourse = {
    ...course,
    sections: course.sections.map((section) =>
      mergeLegacySectionTree(section, byLesson)
    ),
  };
  return applyLegacyCourseVisibility(merged, options);
}

async function fetchLessonContentMapUncached(): Promise<
  Map<string, AcademyLessonContentRow>
> {
  const { data: rows } = await supabaseAdmin
    .from("academy_lesson_content")
    .select(
      "course_id, lesson_id, title, video_url, body_markdown, guide_markdown, transcript_text, duration, recommended_actions, is_draft, is_deleted, updated_at"
    );
  const map = new Map<string, AcademyLessonContentRow>();
  for (const row of rows ?? []) {
    const r = row as AcademyLessonContentRow;
    map.set(lessonKey(r.course_id, r.lesson_id), r);
  }
  return map;
}

const LESSON_CONTENT_MAP_TTL_MS = 10 * 60 * 1000;
let lessonContentMapCache:
  | { map: Map<string, AcademyLessonContentRow>; expiresAt: number }
  | null = null;

function invalidateLessonContentMapCache() {
  lessonContentMapCache = null;
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
  return mergeLegacyLesson(base, row);
}

export async function upsertAcademyLessonContent(input: {
  courseId: string;
  lessonId: string;
  title?: string | null;
  videoUrl?: string | null;
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

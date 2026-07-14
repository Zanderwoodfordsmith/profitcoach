import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { AcademyCatalog, AcademyLesson } from "./types";
import type { LegacyHubCourse, LegacyHubLesson } from "./legacyHubCatalog";
import { loadAcademyCatalog, loadAcademyCatalogSync } from "./catalog";
import {
  hasInAppLessonContent,
  type LessonInAppContent,
} from "./lessonContentUtils";

export type { LessonInAppContent } from "./lessonContentUtils";
export { hasInAppLessonContent } from "./lessonContentUtils";

export type AcademyLessonContentRow = {
  course_id: string;
  lesson_id: string;
  title: string | null;
  video_url: string | null;
  body_markdown: string | null;
  transcript_text: string | null;
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

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

function lessonContentFromRow(
  row: AcademyLessonContentRow | null | undefined
): LessonInAppContent | null {
  if (!row) return null;
  const videoUrl = row.video_url;
  const bodyMarkdown = row.body_markdown ?? "";
  const transcriptText = transcriptFromRow(row);
  if (!hasInAppLessonContent(videoUrl, bodyMarkdown, transcriptText)) return null;
  return {
    videoUrl: videoUrl?.trim() || null,
    bodyMarkdown,
    transcriptText,
  };
}

function mergeLesson(base: AcademyLesson, row: AcademyLessonContentRow | undefined): AcademyLesson {
  if (!row) return base;
  const titleOverride = titleFromRow(row);
  const content = lessonContentFromRow(row);
  return {
    ...base,
    ...(titleOverride ? { title: titleOverride } : {}),
    videoUrl: row.video_url,
    bodyMarkdown: row.body_markdown ?? "",
    transcriptText: content?.transcriptText ?? null,
  };
}

export function mergeLegacyLesson(
  base: LegacyHubLesson,
  row: AcademyLessonContentRow | null | undefined
): LegacyHubLesson & LessonInAppContent {
  const titleOverride = titleFromRow(row ?? undefined);
  const merged = {
    ...base,
    ...(titleOverride ? { title: titleOverride } : {}),
  };
  const content = lessonContentFromRow(row ?? undefined);
  if (!content) {
    return { ...merged, videoUrl: null, bodyMarkdown: "", transcriptText: null };
  }
  return { ...merged, ...content };
}

/** Legacy programme course with per-lesson DB overrides (titles, video, body, transcript). */
export async function loadLegacyCourseWithContent(
  course: LegacyHubCourse
): Promise<LegacyHubCourse> {
  const { data: rows } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("*")
    .eq("course_id", course.id);

  const byLesson = new Map<string, AcademyLessonContentRow>();
  for (const row of rows ?? []) {
    const r = row as AcademyLessonContentRow;
    byLesson.set(r.lesson_id, r);
  }

  return {
    ...course,
    sections: course.sections.map((section) => ({
      ...section,
      lessons: section.lessons.map((lesson) =>
        mergeLegacyLesson(lesson, byLesson.get(lesson.id))
      ),
    })),
  };
}

async function fetchLessonContentMapUncached(): Promise<
  Map<string, AcademyLessonContentRow>
> {
  const { data: rows } = await supabaseAdmin
    .from("academy_lesson_content")
    .select(
      "course_id, lesson_id, title, video_url, body_markdown, transcript_text, updated_at"
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
        lessons: (course.lessons ?? []).map((lesson) =>
          mergeLesson(lesson, byKey.get(lessonKey(course.id, lesson.id)))
        ),
      })),
    })),
  };
}

/** Catalog with DB lesson overrides merged in. */
export async function loadAcademyCatalogWithDb(): Promise<AcademyCatalog> {
  const catalog = await loadAcademyCatalog();
  const byKey = await fetchLessonContentMap();
  return applyLessonContentToCatalog(catalog, byKey);
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
  base: LegacyHubLesson
): Promise<LegacyHubLesson & LessonInAppContent> {
  const row = await loadAcademyLessonContentRow(courseId, lessonId);
  return mergeLegacyLesson(base, row);
}

export async function upsertAcademyLessonContent(input: {
  courseId: string;
  lessonId: string;
  title?: string | null;
  videoUrl?: string | null;
  bodyMarkdown?: string | null;
  transcriptText?: string | null;
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
    transcript_text:
      input.transcriptText !== undefined
        ? input.transcriptText?.trim() || null
        : (existing?.transcript_text ?? null),
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

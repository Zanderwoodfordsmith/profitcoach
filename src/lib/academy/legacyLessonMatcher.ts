import type { LegacyHubCatalog, LegacyHubCourse } from "./legacyHubCatalog";
import {
  lessonTitleMatchScore,
  normalizeMatchText,
  resolveCourseIdFromFolderName,
  tokenSimilarity,
} from "./normalizeMatchText";

export type LegacyLessonIndexEntry = {
  courseId: string;
  courseTitle: string;
  sectionTitle: string;
  lessonId: string;
  lessonTitle: string;
  hasVideo: boolean;
};

export type LessonMatchCandidate = {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  score: number;
};

export type LessonMatchResult =
  | { status: "matched"; match: LessonMatchCandidate }
  | { status: "ambiguous"; candidates: LessonMatchCandidate[] }
  | { status: "unmatched"; bestScore: number; bestCandidate: LessonMatchCandidate | null };

export function buildLegacyLessonIndex(catalog: LegacyHubCatalog): LegacyLessonIndexEntry[] {
  const out: LegacyLessonIndexEntry[] = [];
  for (const course of catalog.courses) {
    for (const section of course.sections) {
      for (const lesson of section.lessons) {
        out.push({
          courseId: course.id,
          courseTitle: course.title,
          sectionTitle: section.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          hasVideo: lesson.hasVideo,
        });
      }
    }
  }
  return out;
}

export function lessonsForCourse(
  index: LegacyLessonIndexEntry[],
  courseId: string
): LegacyLessonIndexEntry[] {
  return index.filter((e) => e.courseId === courseId);
}

export function matchStemToLesson(
  stem: string,
  courseLessons: LegacyLessonIndexEntry[],
  options: {
    minScore?: number;
    minMargin?: number;
    preferVideo?: boolean;
  } = {}
): LessonMatchResult {
  const minScore = options.minScore ?? 0.72;
  const minMargin = options.minMargin ?? 0.05;
  const preferVideo = options.preferVideo ?? true;

  const scored: LessonMatchCandidate[] = courseLessons.map((l) => {
    let score = Math.max(
      lessonTitleMatchScore(stem, l.lessonTitle),
      lessonTitleMatchScore(stem, lessonIdMatchText(l.lessonId, l.courseId))
    );
    if (preferVideo && l.hasVideo) score += 0.02;
    return {
      courseId: l.courseId,
      lessonId: l.lessonId,
      lessonTitle: l.lessonTitle,
      score: Math.min(score, 1),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];

  if (!top || top.score < 0.65) {
    return {
      status: "unmatched",
      bestScore: top?.score ?? 0,
      bestCandidate: top ?? null,
    };
  }

  const margin = top.score - (second?.score ?? 0);
  if (top.score >= minScore && margin >= minMargin) {
    return { status: "matched", match: top };
  }

  const ambiguousCandidates = scored.filter((c) => c.score >= 0.65).slice(0, 3);
  return { status: "ambiguous", candidates: ambiguousCandidates };
}

export function resolveCourseIdForPathSegment(
  segment: string,
  courses: LegacyHubCourse[]
): string | null {
  const fromAlias = resolveCourseIdFromFolderName(segment);
  if (fromAlias) return fromAlias;

  const norm = normalizeMatchText(segment);
  let best: { id: string; score: number } | null = null;
  for (const c of courses) {
    const score = tokenSimilarity(norm, c.title);
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best && best.score >= 0.55 ? best.id : null;
}

const RAW_UUID =
  /[-_]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Logical stem from a file basename (handles `foo.mp4.docx`). */
export function stemFromFileName(fileName: string): string {
  let base = fileName;
  if (base.toLowerCase().endsWith(".mp4.docx")) {
    base = base.slice(0, -".docx".length);
  }
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".")) : "";
  if (/\.(mp4|mov|webm|m4v|txt|md|docx|srt|vtt)$/i.test(ext)) {
    base = base.slice(0, -ext.length);
  }
  base = base.replace(RAW_UUID, "");
  base = base.replace(/\s*\(\s*1\s*\)\s*$/i, "");
  return normalizeMatchText(base);
}

/** Human-readable slug from lesson id (suffix after course id). */
export function lessonIdMatchText(lessonId: string, courseId: string): string {
  const prefix = `${courseId}-`;
  const suffix = lessonId.startsWith(prefix) ? lessonId.slice(prefix.length) : lessonId;
  return normalizeMatchText(suffix.replace(/-/g, " "));
}

export type MediaFileKind = "video" | "transcript" | "skip";

export function classifyMediaFile(fileName: string): MediaFileKind {
  const lower = fileName.toLowerCase();
  if (lower === ".ds_store" || lower.endsWith("/.ds_store")) return "skip";
  if (lower.endsWith(".mp4.docx") || lower.endsWith(".mov.docx")) return "transcript";
  if (/\.(mp4|mov|webm|m4v)$/i.test(lower)) return "video";
  if (/\.(txt|md|docx|srt|vtt)$/i.test(lower)) return "transcript";
  return "skip";
}

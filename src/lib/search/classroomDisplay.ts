import { flattenLessonsInSections, type HubCatalog } from "@/lib/academy/hubCatalog";
import { loadArchiveHub } from "@/lib/academy/archiveHubLoad";
import { loadClassroomHubForImport } from "@/lib/academy/importHubLoad";
import {
  parseLessonVideoChapters,
  legacyConsolidatedChapterRedirect,
} from "@/lib/academy/lessonVideoChapters";
import { formatTranscriptClock } from "@/lib/academy/transcriptCues";
import {
  findTranscriptCueSeconds,
  plainTextFromHeadline,
  type SearchClassroomItem,
} from "@/lib/search/types";
const COURSE_ID_PREFIXES = [
  "profit-brand-framework",
  "coach-clients",
  "win-clients",
  "get-calls",
  "start-here",
  "going-pro",
  "client-delivery",
  "client-acquisition",
  "coach-action-plan",
];

/** Retired / duplicate course prefixes → current hub course prefixes. */
const COURSE_PREFIX_SWAPS: Array<[string, string]> = [
  ["client-delivery-", "coach-clients-"],
  ["client-acquisition-", "get-calls-"],
  ["client-acquisition-", "win-clients-"],
  ["profit-brand-framework-", "coach-clients-"],
];

type HubTitleRow = {
  title: string;
  courseId: string;
  courseTitle: string;
};

let hubTitleIndex: Map<string, HubTitleRow> | null = null;

function titleIndex(): Map<string, HubTitleRow> {
  if (hubTitleIndex) return hubTitleIndex;
  const map = new Map<string, HubTitleRow>();
  const catalogs: HubCatalog[] = [loadArchiveHub(), loadClassroomHubForImport()];
  for (const catalog of catalogs) {
    for (const course of catalog.courses) {
      for (const lesson of flattenLessonsInSections(course.sections)) {
        map.set(lesson.id, {
          title: lesson.title,
          courseId: course.id,
          courseTitle: course.title,
        });
      }
    }
  }
  hubTitleIndex = map;
  return map;
}

export function titleLooksLikeLessonId(
  title: string | null | undefined,
  lessonId: string | null | undefined
): boolean {
  const t = (title ?? "").trim();
  const id = (lessonId ?? "").trim();
  if (!t) return true;
  if (id && t.toLowerCase() === id.toLowerCase()) return true;
  if (/\s/.test(t)) return false;
  return t.includes("-") && t.length > 20;
}

export function humanizeLessonId(lessonId: string): string {
  let stem = lessonId.trim();
  for (const prefix of COURSE_ID_PREFIXES) {
    if (stem.startsWith(`${prefix}-`)) {
      stem = stem.slice(prefix.length + 1);
      break;
    }
  }
  return stem
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function resolveHubLessonId(lessonId: string): string {
  const index = titleIndex();
  if (index.has(lessonId)) return lessonId;
  for (const [from, to] of COURSE_PREFIX_SWAPS) {
    if (!lessonId.startsWith(from)) continue;
    const alt = `${to}${lessonId.slice(from.length)}`;
    if (index.has(alt) || legacyConsolidatedChapterRedirect(alt)) return alt;
  }
  return lessonId;
}

export function classroomSearchLessonIds(lessonId: string): string[] {
  const ids = new Set<string>([lessonId]);
  const hubId = resolveHubLessonId(lessonId);
  ids.add(hubId);
  const legacy = legacyConsolidatedChapterRedirect(hubId);
  if (legacy?.lessonId) ids.add(legacy.lessonId);
  return [...ids];
}

export function hubTitleForLesson(lessonId: string | null | undefined): string | null {
  if (!lessonId) return null;
  const resolved = resolveHubLessonId(lessonId);
  return titleIndex().get(resolved)?.title?.trim() || null;
}

export function displayLessonTitle(
  lessonId: string | null | undefined,
  dbTitle: string | null | undefined
): string {
  const hub = hubTitleForLesson(lessonId);
  if (hub) return hub;
  if (dbTitle && !titleLooksLikeLessonId(dbTitle, lessonId)) return dbTitle.trim();
  if (lessonId) return humanizeLessonId(lessonId);
  return dbTitle?.trim() || "Lesson";
}

function chapterTitleFromChapters(
  raw: unknown,
  chapterId: string | null | undefined
): string | null {
  if (!chapterId) return null;
  const chapters = parseLessonVideoChapters(raw);
  const hit = chapters.find((c) => c.id === chapterId);
  if (hit?.title?.trim()) return hit.title.trim();
  return humanizeLessonId(chapterId);
}

const HEADLINE_TIMESTAMP_RE = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/;

export function secondsFromHeadlineTimestamp(
  headline: string | null | undefined,
  query?: string
): number | null {
  const text = plainTextFromHeadline(headline);
  const matches = [...text.matchAll(new RegExp(HEADLINE_TIMESTAMP_RE, "g"))];
  if (matches.length === 0) return null;
  const q = (query ?? "").toLowerCase().trim();
  const qIdx = q.length >= 6 ? text.toLowerCase().indexOf(q) : -1;
  let pick = matches[matches.length - 1];
  if (qIdx >= 0 && matches.length > 1) {
    let bestDist = Infinity;
    for (const m of matches) {
      const dist = Math.abs((m.index ?? 0) - qIdx);
      if (dist < bestDist) {
        pick = m;
        bestDist = dist;
      }
    }
  }
  const a = Number(pick[1]);
  const b = Number(pick[2]);
  const c = pick[3] != null ? Number(pick[3]) : null;
  const seconds = c != null ? a * 3600 + b * 60 + c : a * 60 + b;
  return Number.isFinite(seconds) ? seconds : null;
}

export function resolveTranscriptCue(
  transcriptText: string | null | undefined,
  headline: string | null | undefined,
  query: string
): { seconds: number; clock: string } | null {
  const fromHeadline = secondsFromHeadlineTimestamp(headline, query);
  if (fromHeadline != null) {
    return { seconds: fromHeadline, clock: formatTranscriptClock(fromHeadline) };
  }
  return findTranscriptCueSeconds(transcriptText, headline, query);
}

type LessonMetaRow = {
  lesson_id: string;
  title: string | null;
  transcript_text: string | null;
  video_chapters: unknown;
};

/**
 * Hub titles, consolidated parent+chapter, and seek time for classroom hits.
 * Transcript lookup stays on the source row so timestamps stay chapter-local.
 */
export function decorateClassroomSearchItems(
  items: SearchClassroomItem[],
  query: string,
  metaByLessonId: Map<string, LessonMetaRow>
): SearchClassroomItem[] {
  const seen = new Set<string>();
  const out: SearchClassroomItem[] = [];

  for (const item of items) {
    if (item.kind !== "lesson" || !item.lesson_id) {
      out.push(item);
      continue;
    }

    const sourceLessonId = item.lesson_id;
    const hubLessonId = resolveHubLessonId(sourceLessonId);
    const legacy = legacyConsolidatedChapterRedirect(hubLessonId);
    const lessonId = legacy?.lessonId ?? hubLessonId;
    const courseId =
      legacy?.courseId ??
      (item.course_id === "client-delivery"
        ? "coach-clients"
        : item.course_id === "client-acquisition"
          ? "get-calls"
          : item.course_id);
    const chapterId = legacy?.chapter ?? null;
    const parentMeta = metaByLessonId.get(lessonId);
    const sourceMeta = metaByLessonId.get(sourceLessonId);
    const title = displayLessonTitle(
      lessonId,
      parentMeta?.title ?? item.title
    );
    const chapterTitle = chapterTitleFromChapters(
      parentMeta?.video_chapters,
      chapterId
    );
    const titleIsSlug = titleLooksLikeLessonId(item.title, sourceLessonId);

    let transcriptSeconds = item.transcript_seconds ?? null;
    let transcriptClock = item.transcript_clock ?? null;
    if (item.transcript_match) {
      const cue = resolveTranscriptCue(
        sourceMeta?.transcript_text ?? parentMeta?.transcript_text,
        item.transcript_headline,
        query
      );
      if (cue) {
        transcriptSeconds = cue.seconds;
        transcriptClock = cue.clock;
      }
    }

    const next: SearchClassroomItem = {
      ...item,
      id: `${courseId ?? item.course_id}/${lessonId}`,
      course_id: courseId,
      lesson_id: lessonId,
      title,
      title_headline: titleIsSlug ? null : item.title_headline,
      chapter_id: chapterId,
      chapter_title: chapterTitle,
      transcript_seconds: transcriptSeconds,
      transcript_clock: transcriptClock,
    };

    const dedupeKey = `${next.course_id}/${next.lesson_id}/${next.chapter_id ?? ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(next);
  }

  return out;
}

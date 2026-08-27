/** Main-lesson video chapters (sequential watch path). Distinct from satellites. */

import {
  parseRecommendedActions,
  type AcademyRecommendedAction,
} from "@/lib/academy/lessonActions";
import consolidatedLessonRegistry from "./consolidatedLessonRegistry.json";

export type LessonVideoChapterInput = {
  id: string;
  title: string;
  /** Direct hosted URL when set. */
  video_url?: string | null;
  /** Pull video from another lesson content row when `video_url` is empty. */
  source_lesson_id?: string | null;
  duration?: string | null;
  /** Step is recommended but skippable (shown in workflow accordions). */
  optional?: boolean | null;
};

export type LessonVideoChapter = {
  id: string;
  title: string;
  videoUrl: string | null;
  duration: string | null;
  optional?: boolean;
  /** Original lesson row when video/guide were pulled from a sibling. */
  sourceLessonId?: string | null;
  guideMarkdown?: string | null;
  bodyMarkdown?: string | null;
  transcriptText?: string | null;
  recommendedActions?: AcademyRecommendedAction[];
};

export type LessonVideoChapterSourceRow = {
  video_url?: string | null;
  guide_markdown?: string | null;
  body_markdown?: string | null;
  transcript_text?: string | null;
  recommended_actions?: unknown;
};

export function isLessonVideoChapterInput(value: unknown): value is LessonVideoChapterInput {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<LessonVideoChapterInput>;
  return (
    typeof row.id === "string" &&
    row.id.trim().length > 0 &&
    typeof row.title === "string" &&
    row.title.trim().length > 0
  );
}

export function parseLessonVideoChapters(raw: unknown): LessonVideoChapterInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isLessonVideoChapterInput).map((chapter) => ({
    id: chapter.id.trim(),
    title: chapter.title.trim(),
    video_url:
      typeof chapter.video_url === "string" ? chapter.video_url.trim() || null : null,
    source_lesson_id:
      typeof chapter.source_lesson_id === "string"
        ? chapter.source_lesson_id.trim() || null
        : null,
    duration:
      typeof chapter.duration === "string" ? chapter.duration.trim() || null : null,
    optional: chapter.optional === true,
  }));
}

type ChapterSourceLookup = (
  lessonId: string
) => LessonVideoChapterSourceRow | null | undefined;

/** Resolve chapter URLs and inherited content from sibling lesson rows. */
export function resolveLessonVideoChapters(
  raw: unknown,
  lookupSource?: ChapterSourceLookup
): LessonVideoChapter[] {
  const lookup = lookupSource ?? (() => undefined);
  const resolved: LessonVideoChapter[] = [];
  for (const chapter of parseLessonVideoChapters(raw)) {
    const direct = chapter.video_url?.trim() || null;
    const sourceRow = chapter.source_lesson_id
      ? lookup(chapter.source_lesson_id)
      : undefined;
    const fromSource = sourceRow?.video_url?.trim() || null;
    const videoUrl = direct || fromSource || null;
    const guideMarkdown = sourceRow?.guide_markdown?.trim() || null;
    const bodyMarkdown = sourceRow?.body_markdown?.trim() || null;
    const transcriptText = sourceRow?.transcript_text?.trim() || null;
    const recommendedActions = parseRecommendedActions(sourceRow?.recommended_actions);
    if (
      !videoUrl &&
      !guideMarkdown &&
      !bodyMarkdown &&
      !transcriptText &&
      recommendedActions.length === 0
    ) {
      continue;
    }
    resolved.push({
      id: chapter.id,
      title: chapter.title,
      videoUrl,
      duration: chapter.duration ?? null,
      optional: chapter.optional === true,
      sourceLessonId: chapter.source_lesson_id ?? null,
      guideMarkdown,
      bodyMarkdown,
      transcriptText,
      recommendedActions,
    });
  }
  return resolved;
}

export function lessonHasVideoChapters(chapters: LessonVideoChapter[] | undefined): boolean {
  const playable = chapters?.filter((chapter) => Boolean(chapter.videoUrl?.trim())) ?? [];
  return playable.length >= 2;
}

/** Parse a sidebar duration label (`4m`, `1h 4m`, `45m`, `90`) to seconds. */
function parseDurationLabelSeconds(label: string | null | undefined): number {
  if (!label) return 0;
  const t = label.trim().toLowerCase();
  let total = 0;
  const h = t.match(/(\d+)\s*h/);
  const m = t.match(/(\d+)\s*m/);
  if (h) total += Number(h[1]) * 3600;
  if (m) total += Number(m[1]) * 60;
  if (!h && !m) {
    const plain = t.match(/^(\d+)$/);
    if (plain) total += Number(plain[1]) * 60;
  }
  return total;
}

const TRANSCRIPT_TIMESTAMP_RE = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

function formatTimestampSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `[${pad(hh)}:${pad(mm)}:${pad(ss)}]`;
}

/** Largest timestamp (seconds) appearing in a transcript, 0 when none. */
function maxTranscriptTimestampSeconds(transcript: string): number {
  let max = 0;
  for (const match of transcript.matchAll(TRANSCRIPT_TIMESTAMP_RE)) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const c = match[3] != null ? Number(match[3]) : null;
    const seconds = c != null ? a * 3600 + b * 60 + c : a * 60 + b;
    if (seconds > max) max = seconds;
  }
  return max;
}

/** Shift every `[hh:mm:ss]`/`[mm:ss]` timestamp forward by `offsetSeconds`. */
function offsetTranscriptTimestamps(transcript: string, offsetSeconds: number): string {
  if (offsetSeconds <= 0) return transcript;
  return transcript.replace(TRANSCRIPT_TIMESTAMP_RE, (_full, a, b, c) => {
    const base =
      c != null
        ? Number(a) * 3600 + Number(b) * 60 + Number(c)
        : Number(a) * 60 + Number(b);
    return formatTimestampSeconds(base + offsetSeconds);
  });
}

/**
 * Combine a chaptered lesson's transcripts into one continuous transcript,
 * treating the lesson as a single recording: each chapter's timestamps are
 * stacked on top of the running total so they keep counting up instead of
 * restarting at zero. Chapters without a transcript still advance the clock by
 * their duration so later timestamps stay aligned.
 */
export function buildLessonTranscriptFromChapters(
  chapters: LessonVideoChapter[] | undefined,
): string | null {
  if (!chapters?.length) return null;
  const parts: string[] = [];
  let offsetSeconds = 0;
  for (const chapter of chapters) {
    const transcript = chapter.transcriptText?.trim();
    if (transcript) {
      const shifted = offsetTranscriptTimestamps(transcript, offsetSeconds);
      parts.push(`## ${chapter.title}\n\n${shifted}`);
      const spanned = maxTranscriptTimestampSeconds(transcript);
      offsetSeconds += Math.max(spanned, parseDurationLabelSeconds(chapter.duration));
    } else {
      offsetSeconds += parseDurationLabelSeconds(chapter.duration);
    }
  }
  if (parts.length === 0) return null;
  return parts.join("\n\n");
}

export function lessonHasContentSteps(chapters: LessonVideoChapter[] | undefined): boolean {
  const steps = chapters?.filter(chapterHasStepContent) ?? [];
  return steps.length >= 2;
}

export const VALUE_SESSIONS_CONSOLIDATED_LESSON_ID =
  "win-clients-book-and-run-value-sessions";

export const LEGACY_VALUE_SESSION_LESSON_IDS = [
  "win-clients-getting-paid-clients-using-value-sessions-what-is-a-value-session",
  "win-clients-getting-paid-clients-using-value-sessions-how-do-value-sessions-get-you-clients",
  "win-clients-getting-paid-clients-using-value-sessions-messages-to-book-value-session",
  "win-clients-getting-paid-clients-using-value-sessions-how-to-create-cvalue-session-calendar-in-the-crm",
  "win-clients-getting-paid-clients-using-value-sessions-how-to-deliver-a-value-session",
  "win-clients-getting-paid-clients-using-value-sessions-how-value-sessions-improve-your-business",
  "win-clients-getting-paid-clients-using-value-sessions-how-to-sell-on-a-value-session",
] as const;

export function isLegacyValueSessionLessonId(lessonId: string): boolean {
  return (LEGACY_VALUE_SESSION_LESSON_IDS as readonly string[]).includes(lessonId);
}

const LEGACY_VALUE_SESSION_CHAPTER_BY_LESSON_ID: Record<string, string> = {
  "win-clients-getting-paid-clients-using-value-sessions-what-is-a-value-session":
    "what-is-a-value-session",
  "win-clients-getting-paid-clients-using-value-sessions-how-do-value-sessions-get-you-clients":
    "how-value-sessions-get-clients",
  "win-clients-getting-paid-clients-using-value-sessions-messages-to-book-value-session":
    "messages-to-book",
  "win-clients-getting-paid-clients-using-value-sessions-how-to-create-cvalue-session-calendar-in-the-crm":
    "crm-calendar",
  "win-clients-getting-paid-clients-using-value-sessions-how-to-deliver-a-value-session":
    "how-to-deliver",
  "win-clients-getting-paid-clients-using-value-sessions-how-value-sessions-improve-your-business":
    "improve-your-business",
  "win-clients-getting-paid-clients-using-value-sessions-how-to-sell-on-a-value-session":
    "how-to-sell",
};

export function legacyValueSessionChapterId(lessonId: string): string | null {
  return LEGACY_VALUE_SESSION_CHAPTER_BY_LESSON_ID[lessonId] ?? null;
}

export const SALES_NAV_CONSOLIDATED_LESSON_ID =
  "get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list";

export const SALES_NAV_BASE_SEARCH_CHAPTER_ID = "base-search";

export const SALES_NAV_BASE_SEARCH_LESSON_ID =
  "get-calls-ideal-clients-linkedin-sales-navigator-build-your-base-search";

export function isSalesNavBaseSearchChapter(
  chapter: Pick<LessonVideoChapter, "id" | "sourceLessonId">
): boolean {
  return (
    chapter.id === SALES_NAV_BASE_SEARCH_CHAPTER_ID ||
    chapter.sourceLessonId === SALES_NAV_BASE_SEARCH_LESSON_ID
  );
}

export function chapterHasStepContent(
  chapter: Pick<
    LessonVideoChapter,
    "guideMarkdown" | "bodyMarkdown" | "videoUrl" | "id" | "sourceLessonId"
  >
): boolean {
  return Boolean(
    chapter.guideMarkdown?.trim() ||
      chapter.bodyMarkdown?.trim() ||
      chapter.videoUrl?.trim() ||
      isSalesNavBaseSearchChapter(chapter)
  );
}

export const LEGACY_SALES_NAV_CHAPTER_LESSON_IDS = [
  "get-calls-ideal-clients-linkedin-sales-navigator-sign-up",
  "get-calls-ideal-clients-linkedin-sales-navigator-build-your-base-search",
  "get-calls-ideal-clients-linkedin-sales-navigator-build-your-ideal-prospect-list",
  "get-calls-ideal-clients-linkedin-sales-navigator-refining-your-ideal-prospect-list-blacklisting",
] as const;

const LEGACY_SALES_NAV_CHAPTER_BY_LESSON_ID: Record<string, string> = {
  "get-calls-ideal-clients-linkedin-sales-navigator-sign-up": "sign-up",
  "get-calls-ideal-clients-linkedin-sales-navigator-build-your-base-search": "base-search",
  "get-calls-ideal-clients-linkedin-sales-navigator-build-your-ideal-prospect-list":
    "prospect-list",
  "get-calls-ideal-clients-linkedin-sales-navigator-refining-your-ideal-prospect-list-blacklisting":
    "refining-blacklist",
};

export function isLegacySalesNavChapterLessonId(lessonId: string): boolean {
  return (LEGACY_SALES_NAV_CHAPTER_LESSON_IDS as readonly string[]).includes(lessonId);
}

export function legacySalesNavChapterId(lessonId: string): string | null {
  return LEGACY_SALES_NAV_CHAPTER_BY_LESSON_ID[lessonId] ?? null;
}

export const PROSPECT_SEARCH_FOUNDATIONS_CONSOLIDATED_LESSON_ID =
  "get-calls-ideal-clients-finding-ideal-clients-mindset-and-search";

export const LEGACY_PROSPECT_SEARCH_FOUNDATIONS_LESSON_IDS = [
  "get-calls-ideal-clients-proactive-prospecting-your-path-to-finding-ideal-clients",
  "get-calls-ideal-clients-principles-of-effective-prospect-search-find",
  "get-calls-ideal-clients-evaluating-prospect-list-kpis",
] as const;

const LEGACY_PROSPECT_SEARCH_FOUNDATIONS_CHAPTER_BY_LESSON_ID: Record<string, string> =
  {
    "get-calls-ideal-clients-proactive-prospecting-your-path-to-finding-ideal-clients":
      "proactive-prospecting",
    "get-calls-ideal-clients-principles-of-effective-prospect-search-find":
      "find-principles",
    "get-calls-ideal-clients-evaluating-prospect-list-kpis": "list-kpis",
  };

export function isLegacyProspectSearchFoundationsLessonId(lessonId: string): boolean {
  return (LEGACY_PROSPECT_SEARCH_FOUNDATIONS_LESSON_IDS as readonly string[]).includes(
    lessonId
  );
}

export function legacyProspectSearchFoundationsChapterId(
  lessonId: string
): string | null {
  return LEGACY_PROSPECT_SEARCH_FOUNDATIONS_CHAPTER_BY_LESSON_ID[lessonId] ?? null;
}

export const LINKEDIN_PROFILE_CONSOLIDATED_LESSON_ID =
  "get-calls-linkedin-optimization-set-up-your-linkedin-profile";

export const LEGACY_LINKEDIN_PROFILE_LESSON_IDS = [
  "get-calls-linkedin-optimization-linkedin-profile-checklist-to-optimise-your-profile",
  "get-calls-linkedin-optimization-linkedin-profile-setup-a-professional-headshot",
  "get-calls-linkedin-optimization-linkedin-profile-designing-your-banner",
  "get-calls-linkedin-optimization-linkedin-profile-dfy-write-your-about-section",
  "get-calls-linkedin-optimization-profit-coach-linkedin-announcement-post",
] as const;

const LEGACY_LINKEDIN_PROFILE_CHAPTER_BY_LESSON_ID: Record<string, string> = {
  "get-calls-linkedin-optimization-linkedin-profile-checklist-to-optimise-your-profile":
    "checklist",
  "get-calls-linkedin-optimization-linkedin-profile-setup-a-professional-headshot": "headshot",
  "get-calls-linkedin-optimization-linkedin-profile-designing-your-banner": "banner",
  "get-calls-linkedin-optimization-linkedin-profile-dfy-write-your-about-section":
    "about-section",
  "get-calls-linkedin-optimization-profit-coach-linkedin-announcement-post":
    "announcement-post",
};

export function isLegacyLinkedInProfileLessonId(lessonId: string): boolean {
  return (LEGACY_LINKEDIN_PROFILE_LESSON_IDS as readonly string[]).includes(lessonId);
}

export function legacyLinkedInProfileChapterId(lessonId: string): string | null {
  return LEGACY_LINKEDIN_PROFILE_CHAPTER_BY_LESSON_ID[lessonId] ?? null;
}

export const UNDERSTAND_IDEAL_CLIENT_CONSOLIDATED_LESSON_ID =
  "get-calls-ideal-clients-understand-your-ideal-client";

export const LEGACY_UNDERSTAND_IDEAL_CLIENT_LESSON_IDS = [
  "get-calls-ideal-clients-give-them-what-they-want-understanding-your-client-s-day",
  "get-calls-ideal-clients-the-mentor-exercise",
] as const;

const LEGACY_UNDERSTAND_IDEAL_CLIENT_CHAPTER_BY_LESSON_ID: Record<string, string> = {
  "get-calls-ideal-clients-give-them-what-they-want-understanding-your-client-s-day":
    "clients-day",
  "get-calls-ideal-clients-the-mentor-exercise": "mentor-exercise",
};

export function isLegacyUnderstandIdealClientLessonId(lessonId: string): boolean {
  return (LEGACY_UNDERSTAND_IDEAL_CLIENT_LESSON_IDS as readonly string[]).includes(
    lessonId
  );
}

export function legacyUnderstandIdealClientChapterId(lessonId: string): string | null {
  return LEGACY_UNDERSTAND_IDEAL_CLIENT_CHAPTER_BY_LESSON_ID[lessonId] ?? null;
}

export type LegacyConsolidatedChapterRedirect = {
  courseId: string;
  lessonId: string;
  chapter: string | null;
};

type ConsolidatedLessonRegistryEntry = {
  courseId: string;
  consolidatedLessonId: string;
  legacyChapterByLessonId: Record<string, string>;
};

const BATCH2_LEGACY_REDIRECT_BY_LESSON_ID = new Map<
  string,
  LegacyConsolidatedChapterRedirect
>();

for (const entry of consolidatedLessonRegistry as unknown as ConsolidatedLessonRegistryEntry[]) {
  for (const [legacyLessonId, chapterId] of Object.entries(
    entry.legacyChapterByLessonId
  )) {
    BATCH2_LEGACY_REDIRECT_BY_LESSON_ID.set(legacyLessonId, {
      courseId: entry.courseId,
      lessonId: entry.consolidatedLessonId,
      chapter: chapterId,
    });
  }
}

/** Old per-chapter lesson URLs → consolidated lesson + ?chapter= */
export function legacyConsolidatedChapterRedirect(
  lessonId: string
): LegacyConsolidatedChapterRedirect | null {
  if (isLegacyValueSessionLessonId(lessonId)) {
    return {
      courseId: "win-clients",
      lessonId: VALUE_SESSIONS_CONSOLIDATED_LESSON_ID,
      chapter: legacyValueSessionChapterId(lessonId),
    };
  }
  if (isLegacySalesNavChapterLessonId(lessonId)) {
    return {
      courseId: "get-calls",
      lessonId: SALES_NAV_CONSOLIDATED_LESSON_ID,
      chapter: legacySalesNavChapterId(lessonId),
    };
  }
  if (isLegacyProspectSearchFoundationsLessonId(lessonId)) {
    return {
      courseId: "get-calls",
      lessonId: PROSPECT_SEARCH_FOUNDATIONS_CONSOLIDATED_LESSON_ID,
      chapter: legacyProspectSearchFoundationsChapterId(lessonId),
    };
  }
  if (isLegacyLinkedInProfileLessonId(lessonId)) {
    return {
      courseId: "get-calls",
      lessonId: LINKEDIN_PROFILE_CONSOLIDATED_LESSON_ID,
      chapter: legacyLinkedInProfileChapterId(lessonId),
    };
  }
  if (isLegacyUnderstandIdealClientLessonId(lessonId)) {
    return {
      courseId: "get-calls",
      lessonId: UNDERSTAND_IDEAL_CLIENT_CONSOLIDATED_LESSON_ID,
      chapter: legacyUnderstandIdealClientChapterId(lessonId),
    };
  }
  return BATCH2_LEGACY_REDIRECT_BY_LESSON_ID.get(lessonId) ?? null;
}

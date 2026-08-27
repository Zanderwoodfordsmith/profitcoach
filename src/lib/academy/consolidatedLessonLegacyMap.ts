/**
 * Maps pre-consolidation lesson ids → chapter ids under the new parent lesson.
 * Used to preserve completion ticks after lessons were merged into chapters.
 */

import consolidatedLessonRegistry from "./consolidatedLessonRegistry.json";
import {
  LINKEDIN_PROFILE_CONSOLIDATED_LESSON_ID,
  PROSPECT_SEARCH_FOUNDATIONS_CONSOLIDATED_LESSON_ID,
  SALES_NAV_CONSOLIDATED_LESSON_ID,
  UNDERSTAND_IDEAL_CLIENT_CONSOLIDATED_LESSON_ID,
  VALUE_SESSIONS_CONSOLIDATED_LESSON_ID,
} from "./lessonVideoChapters";

export type ConsolidatedLessonLegacyEntry = {
  courseId: string;
  consolidatedLessonId: string;
  /** Old standalone lesson id → chapter id on the parent. */
  legacyChapterByLessonId: Record<string, string>;
};

type RegistryEntry = {
  courseId: string;
  consolidatedLessonId: string;
  legacyChapterByLessonId: Record<string, string>;
};

/** Batch-1 consolidations that predate consolidatedLessonRegistry.json. */
const EARLY_CONSOLIDATIONS: ConsolidatedLessonLegacyEntry[] = [
  {
    courseId: "win-clients",
    consolidatedLessonId: VALUE_SESSIONS_CONSOLIDATED_LESSON_ID,
    legacyChapterByLessonId: {
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
    },
  },
  {
    courseId: "get-calls",
    consolidatedLessonId: SALES_NAV_CONSOLIDATED_LESSON_ID,
    legacyChapterByLessonId: {
      "get-calls-ideal-clients-linkedin-sales-navigator-sign-up": "sign-up",
      "get-calls-ideal-clients-linkedin-sales-navigator-build-your-base-search":
        "base-search",
      "get-calls-ideal-clients-linkedin-sales-navigator-build-your-ideal-prospect-list":
        "prospect-list",
      "get-calls-ideal-clients-linkedin-sales-navigator-refining-your-ideal-prospect-list-blacklisting":
        "refining-blacklist",
    },
  },
  {
    courseId: "get-calls",
    consolidatedLessonId: PROSPECT_SEARCH_FOUNDATIONS_CONSOLIDATED_LESSON_ID,
    legacyChapterByLessonId: {
      "get-calls-ideal-clients-proactive-prospecting-your-path-to-finding-ideal-clients":
        "proactive-prospecting",
      "get-calls-ideal-clients-principles-of-effective-prospect-search-find":
        "find-principles",
      "get-calls-ideal-clients-evaluating-prospect-list-kpis": "list-kpis",
    },
  },
  {
    courseId: "get-calls",
    consolidatedLessonId: LINKEDIN_PROFILE_CONSOLIDATED_LESSON_ID,
    legacyChapterByLessonId: {
      "get-calls-linkedin-optimization-linkedin-profile-checklist-to-optimise-your-profile":
        "checklist",
      "get-calls-linkedin-optimization-linkedin-profile-setup-a-professional-headshot":
        "headshot",
      "get-calls-linkedin-optimization-linkedin-profile-designing-your-banner": "banner",
      "get-calls-linkedin-optimization-linkedin-profile-dfy-write-your-about-section":
        "about-section",
      "get-calls-linkedin-optimization-profit-coach-linkedin-announcement-post":
        "announcement-post",
    },
  },
  {
    courseId: "get-calls",
    consolidatedLessonId: UNDERSTAND_IDEAL_CLIENT_CONSOLIDATED_LESSON_ID,
    legacyChapterByLessonId: {
      "get-calls-ideal-clients-give-them-what-they-want-understanding-your-client-s-day":
        "clients-day",
      "get-calls-ideal-clients-the-mentor-exercise": "mentor-exercise",
    },
  },
];

export const CONSOLIDATED_LESSON_LEGACY_ENTRIES: ConsolidatedLessonLegacyEntry[] = [
  ...EARLY_CONSOLIDATIONS,
  ...(consolidatedLessonRegistry as RegistryEntry[]).map((entry) => ({
    courseId: entry.courseId,
    consolidatedLessonId: entry.consolidatedLessonId,
    legacyChapterByLessonId: entry.legacyChapterByLessonId,
  })),
];

/** Flat lookup: old lesson id → { parent, chapter, course }. */
const LEGACY_LOOKUP = new Map<
  string,
  { courseId: string; consolidatedLessonId: string; chapterId: string }
>();

for (const entry of CONSOLIDATED_LESSON_LEGACY_ENTRIES) {
  for (const [legacyLessonId, chapterId] of Object.entries(
    entry.legacyChapterByLessonId
  )) {
    LEGACY_LOOKUP.set(legacyLessonId, {
      courseId: entry.courseId,
      consolidatedLessonId: entry.consolidatedLessonId,
      chapterId,
    });
  }
}

export function legacyLessonToConsolidatedChapter(legacyLessonId: string): {
  courseId: string;
  consolidatedLessonId: string;
  chapterId: string;
} | null {
  return LEGACY_LOOKUP.get(legacyLessonId) ?? null;
}

/**
 * Classroom hub cards (product names) and programme storage prefixes
 * after the 2026-10 classroom id rename.
 *
 * Storage `course_id`s follow lesson prefixes via `progressCourseId()`.
 */

export const CLASSROOM_START_COURSE_IDS = [
  "start-here",
  "coach-action-plan",
  "going-pro",
] as const;

/** Get Calls, Win Clients, Coach Clients. */
export const CLASSROOM_PATH_COURSE_IDS = [
  "get-calls",
  "win-clients",
  "coach-clients",
] as const;

/**
 * Retired Classroom path. Kept for URL redirects and legacy action/progress
 * labels — the course is no longer in the hub.
 */
export const CLASSROOM_OS_COURSE_ID = "profit-coach-os" as const;

export function isRetiredClassroomCourseId(courseId: string): boolean {
  return courseId === CLASSROOM_OS_COURSE_ID;
}

export const START_HERE_COURSE_ID = "start-here";

export const START_HERE_WELCOME_LESSON_ID =
  "start-here-welcome-welcome-program-overview";

export const START_HERE_WELCOME_PATH =
  `/coach/academy/classroom/${START_HERE_COURSE_ID}/${START_HERE_WELCOME_LESSON_ID}`;

/**
 * Hub course id aliases (old URL segment → current).
 * Lesson aliases live in `classroomIdAliases` map.
 */
export const CLASSROOM_COURSE_ID_ALIASES: Record<string, string> = {
  kickstart: "start-here",
  "client-acquisition": "get-calls",
  "get-clients": "get-calls",
  "profit-coach-system": "coach-clients",
  "client-delivery": "coach-clients",
  "profit-coach-certification": "coach-clients",
  "client-retention": "coach-clients",
};

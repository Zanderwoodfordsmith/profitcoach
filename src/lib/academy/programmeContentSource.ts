/**
 * Hub lesson ids keep programme-style prefixes; progress and content follow
 * the programme `course_id` derived from that prefix (not only the hub card
 * the coach opened).
 *
 * Keep in sync with `academy_canonical_course_id()` in
 * `supabase/migrations/20261014130000_academy_classroom_id_rename.sql`.
 */

const PROGRAMME_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["profit-coach-os-", "profit-coach-os"],
  ["coach-clients-", "coach-clients"],
  ["win-clients-", "win-clients"],
  ["get-calls-", "get-calls"],
  ["start-here-", "start-here"],
  ["coach-action-plan-", "coach-action-plan"],
  ["going-pro-", "going-pro"],
  // Legacy prefixes (pre-rename) — still resolve for old bookmarks / data.
  ["profit-coach-certification-", "coach-clients"],
  ["profit-brand-framework-", "profit-brand-framework"],
  // Win Clients lived under client-acquisition-* before pass 2.
  [
    "client-acquisition-getting-paid-clients-using-value-sessions-",
    "win-clients",
  ],
  ["client-acquisition-sales-pitch-", "win-clients"],
  ["client-acquisition-client-closing-", "win-clients"],
  ["client-acquisition-", "get-calls"],
  ["client-delivery-", "coach-clients"],
  ["client-retention-", "coach-clients"],
  ["kickstart-", "start-here"],
];

/** Programme that owns this lesson, or null when the prefix is unknown. */
export function programmeCourseIdForLesson(lessonId: string): string | null {
  for (const [prefix, courseId] of PROGRAMME_PREFIXES) {
    if (lessonId.startsWith(prefix)) return courseId;
  }
  return null;
}

export function contentSourceCourseId(lessonId: string): string {
  return programmeCourseIdForLesson(lessonId) ?? "start-here";
}

/**
 * Course id that lesson progress is stored under. Hub cards are presentation
 * only, so ticks follow the programme; ids outside the Classroom hub (the
 * Compass catalog's `compass`, `engine`, …) are left untouched.
 */
export function progressCourseId(hubCourseId: string, lessonId: string): string {
  return programmeCourseIdForLesson(lessonId) ?? hubCourseId;
}

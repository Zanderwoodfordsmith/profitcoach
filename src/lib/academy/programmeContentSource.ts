/**
 * Hub lesson ids keep their original programme prefixes, so in-app content
 * (video / body / guide / resources / visibility) and lesson progress live
 * under the programme `course_id` rather than the hub card id a coach happened
 * to open the lesson from.
 *
 * Classroom cards are presentation-only (Start Here, Get Calls, Win Clients,
 * Coach Clients, …). Storage keys may still use older programme ids such as
 * `kickstart` or `client-acquisition`.
 *
 * Keep in sync with `academy_canonical_course_id()` in
 * `supabase/migrations/20260902120000_academy_progress_canonical_course_id.sql`.
 */

const PROGRAMME_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["profit-coach-os-", "profit-coach-os"],
  ["profit-coach-certification-", "profit-coach-certification"],
  ["profit-brand-framework-", "profit-brand-framework"],
  ["client-acquisition-", "client-acquisition"],
  ["client-delivery-", "client-delivery"],
  ["client-retention-", "profit-coach-system"],
  ["coach-action-plan-", "coach-action-plan"],
  ["going-pro-", "going-pro"],
  ["kickstart-", "kickstart"],
];

/** Programme that owns this lesson, or null when the prefix is unknown. */
export function programmeCourseIdForLesson(lessonId: string): string | null {
  for (const [prefix, courseId] of PROGRAMME_PREFIXES) {
    if (lessonId.startsWith(prefix)) return courseId;
  }
  return null;
}

export function contentSourceCourseId(lessonId: string): string {
  return programmeCourseIdForLesson(lessonId) ?? "kickstart";
}

/**
 * Course id that lesson progress is stored under. Hub cards are presentation
 * only, so ticks follow the programme; ids outside the Classroom hub (the
 * Compass catalog's `compass`, `engine`, …) are left untouched.
 */
export function progressCourseId(hubCourseId: string, lessonId: string): string {
  return programmeCourseIdForLesson(lessonId) ?? hubCourseId;
}

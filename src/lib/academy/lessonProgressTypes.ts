export type LessonProgressStatus = "not_started" | "completed" | "needs_review";

export type LessonProgressMap = Record<string, LessonProgressStatus>;

/** ISO timestamps keyed by lesson id (last opened). */
export type LessonViewMap = Record<string, string>;

export const LESSON_PROGRESS_STATUSES: LessonProgressStatus[] = [
  "not_started",
  "completed",
  "needs_review",
];

export function isLessonProgressStatus(value: unknown): value is LessonProgressStatus {
  return (
    typeof value === "string" &&
    (LESSON_PROGRESS_STATUSES as string[]).includes(value)
  );
}

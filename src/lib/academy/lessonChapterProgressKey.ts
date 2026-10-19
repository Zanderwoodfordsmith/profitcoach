/**
 * Lesson chapter progress keys and types, safe for the browser (progress reads and writes stay in lessonChapterProgress.ts).
 */

/** `${lessonId}:${chapterId}` → completed */
export type LessonChapterProgressMap = Record<string, true>;

export function lessonChapterProgressKey(
  lessonId: string,
  chapterId: string
): string {
  return `${lessonId}:${chapterId}`;
}

import type { AcademyCategory, AcademyCourse, AcademyLesson } from "./types";

/** What a Compass lesson keeps back until the member is signed in (see /api/academy/lesson?hub=compass). */
export type CompassLessonContent = Pick<
  AcademyLesson,
  "videoUrl" | "audioUrl" | "bodyMarkdown" | "guideMarkdown" | "recommendedActions" | "transcriptText"
>;

export function compassLessonContent(lesson: AcademyLesson): CompassLessonContent {
  return {
    videoUrl: lesson.videoUrl ?? null,
    audioUrl: lesson.audioUrl ?? null,
    bodyMarkdown: lesson.bodyMarkdown,
    guideMarkdown: lesson.guideMarkdown,
    recommendedActions: lesson.recommendedActions,
    transcriptText: lesson.transcriptText ?? null,
  };
}

/** Title, length and flags only. */
export function slimCompassLesson(lesson: AcademyLesson): AcademyLesson {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { videoUrl, audioUrl, bodyMarkdown, guideMarkdown, recommendedActions, transcriptText, ...shell } = lesson;
  return shell;
}

export function slimCompassCourse(course: AcademyCourse): AcademyCourse {
  return { ...course, lessons: (course.lessons ?? []).map(slimCompassLesson) };
}

export function slimCompassCategory(category: AcademyCategory): AcademyCategory {
  return { ...category, courses: (category.courses ?? []).map(slimCompassCourse) };
}

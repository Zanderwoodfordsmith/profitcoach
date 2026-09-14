import "server-only";

import { findLessonInCourse, type HubCourse, type HubLesson } from "@/lib/academy/hubCatalog";
import {
  loadClassroomCourseWithContent,
  type LoadClassroomCourseOptions,
} from "@/lib/academy/lessonContent";
import type { LessonVideoChapter } from "@/lib/academy/lessonVideoChapters";
import { loadLessonResources, type AcademyResourceRow } from "@/lib/academy/resources";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";

export type ClassroomLessonPayload = {
  course: HubCourse;
  lesson: HubLesson;
  videoUrl: string | null;
  videoChapters: LessonVideoChapter[];
  audioUrl: string | null;
  bodyMarkdown: string;
  guideMarkdown: string;
  transcriptText: string | null;
  lessonResources: AcademyResourceRow[];
};

export async function loadClassroomLessonPayload(
  course: HubCourse,
  lessonId: string,
  options: LoadClassroomCourseOptions = {},
): Promise<ClassroomLessonPayload> {
  const [merged, lessonResources] = await Promise.all([
    loadClassroomCourseWithContent(course, {
      ...options,
      activeLessonId: lessonId,
    }),
    loadLessonResources(contentSourceCourseId(lessonId), lessonId),
  ]);
  const lesson = findLessonInCourse(merged, lessonId);
  if (!lesson) {
    throw new Error(`Lesson not found: ${lessonId}`);
  }
  return {
    course: merged,
    lesson,
    videoUrl: "videoUrl" in lesson ? lesson.videoUrl ?? null : null,
    videoChapters:
      "videoChapters" in lesson && Array.isArray(lesson.videoChapters)
        ? lesson.videoChapters
        : [],
    audioUrl: "audioUrl" in lesson ? lesson.audioUrl ?? null : null,
    bodyMarkdown: "bodyMarkdown" in lesson ? lesson.bodyMarkdown ?? "" : "",
    guideMarkdown: "guideMarkdown" in lesson ? lesson.guideMarkdown ?? "" : "",
    transcriptText:
      "transcriptText" in lesson ? lesson.transcriptText ?? null : null,
    lessonResources,
  };
}

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";

import {
  findHubCourse,
  findLessonInCourse,
  type HubCatalog,
} from "./hubCatalog";
import {
  loadClassroomCourseWithContent,
  upsertAcademyLessonContent,
} from "./lessonContent";
import { contentSourceCourseId } from "./programmeContentSource";

type Body = {
  title?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  bodyMarkdown?: string | null;
  guideMarkdown?: string | null;
  transcriptText?: string | null;
  duration?: string | null;
  recommendedActions?: { id: string; text: string }[] | null;
};

/**
 * Save an admin edit to a hub lesson (programmes archive or simplified hub).
 * Hub card ids are presentation only, so the row is written under the lesson's
 * programme id — see `contentSourceCourseId`.
 */
export async function patchHubLessonContent(
  request: Request,
  params: { courseId: string; lessonId: string },
  data: HubCatalog
): Promise<Response> {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { courseId, lessonId } = params;
  const course = findHubCourse(data, courseId);
  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const baseLesson = findLessonInCourse(course, lessonId);
  if (!baseLesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const body = (await request.json()) as Body;

  try {
    await upsertAcademyLessonContent({
      courseId: contentSourceCourseId(lessonId),
      lessonId,
      title: body.title,
      videoUrl: body.videoUrl,
      audioUrl: body.audioUrl,
      bodyMarkdown: body.bodyMarkdown,
      guideMarkdown: body.guideMarkdown,
      transcriptText: body.transcriptText,
      duration: body.duration,
      recommendedActions: body.recommendedActions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save." },
      { status: 500 }
    );
  }

  const mergedCourse = await loadClassroomCourseWithContent(course, {
    includeDrafts: true,
  });
  const lesson = findLessonInCourse(mergedCourse, lessonId) ?? baseLesson;
  return NextResponse.json({ course: mergedCourse, lesson });
}

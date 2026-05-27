import { NextResponse } from "next/server";

import { findLegacyCourse, findLessonInCourse } from "@/lib/academy/legacyHubCatalog";
import { loadLegacyHub } from "@/lib/academy/legacyHubLoad";
import {
  loadLegacyCourseWithContent,
  upsertAcademyLessonContent,
} from "@/lib/academy/lessonContent";
import { requireAdmin } from "@/lib/requireAdmin";

type Body = {
  title?: string | null;
  videoUrl?: string | null;
  bodyMarkdown?: string | null;
  transcriptText?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { courseId, lessonId } = await context.params;
  const data = loadLegacyHub();
  const course = findLegacyCourse(data, courseId);
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
      courseId,
      lessonId,
      title: body.title,
      videoUrl: body.videoUrl,
      bodyMarkdown: body.bodyMarkdown,
      transcriptText: body.transcriptText,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save." },
      { status: 500 }
    );
  }

  const mergedCourse = await loadLegacyCourseWithContent(course);
  const lesson =
    findLessonInCourse(mergedCourse, lessonId) ?? baseLesson;
  return NextResponse.json({ course: mergedCourse, lesson });
}

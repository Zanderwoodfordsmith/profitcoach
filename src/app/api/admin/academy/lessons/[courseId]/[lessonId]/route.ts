import { NextResponse } from "next/server";

import {
  findMergedLesson,
  loadAcademyCatalogWithDb,
  upsertAcademyLessonContent,
} from "@/lib/academy/lessonContent";
import { findCourse, loadAcademyCatalog } from "@/lib/academy/catalog";
import type { AcademyLesson } from "@/lib/academy/types";
import { requireAdmin } from "@/lib/requireAdmin";

type Body = {
  title?: string | null;
  videoUrl?: string | null;
  bodyMarkdown?: string | null;
  transcriptText?: string | null;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { courseId, lessonId } = await context.params;
  const catalog = await loadAcademyCatalogWithDb();
  const found = findCourse(catalog, courseId);
  if (!found) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const lesson = found.course.lessons?.find((l) => l.id === lessonId);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  return NextResponse.json({
    category: found.category,
    course: found.course,
    lesson,
  });
}

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
  const catalog = await loadAcademyCatalog();
  const found = findCourse(catalog, courseId);
  if (!found) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const baseLesson = found.course.lessons?.find((l) => l.id === lessonId);
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

  const lesson = (await findMergedLesson(catalog, courseId, lessonId)) as AcademyLesson;
  const course = {
    ...found.course,
    lessons: (found.course.lessons ?? []).map((l) =>
      l.id === lesson.id ? lesson : l
    ),
  };
  return NextResponse.json({
    category: found.category,
    course,
    lesson,
  });
}

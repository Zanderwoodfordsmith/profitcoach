import { NextResponse } from "next/server";

import { setLessonChapterCompleted } from "@/lib/academy/lessonChapterProgress";
import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";

type Params = { params: Promise<{ courseId: string; lessonId: string }> };

export async function PUT(request: Request, { params }: Params) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  const { courseId, lessonId } = await params;
  if (!courseId?.trim() || !lessonId?.trim()) {
    return NextResponse.json({ error: "Missing course or lesson id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    chapterId?: unknown;
    completed?: unknown;
  };

  if (typeof body.chapterId !== "string" || !body.chapterId.trim()) {
    return NextResponse.json({ error: "Missing chapter id." }, { status: 400 });
  }
  if (typeof body.completed !== "boolean") {
    return NextResponse.json({ error: "Invalid completed flag." }, { status: 400 });
  }

  const result = await setLessonChapterCompleted({
    userId: authCheck.userId,
    courseId: courseId.trim(),
    lessonId: lessonId.trim(),
    chapterId: body.chapterId.trim(),
    completed: body.completed,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, parentStatus: result.parentStatus });
}

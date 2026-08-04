import { NextResponse } from "next/server";

import { setLessonProgressStatus } from "@/lib/academy/lessonProgress";
import { isLessonProgressStatus } from "@/lib/academy/lessonProgressTypes";
import {
  isStartHereLessonId,
  START_HERE_COURSE_ID,
  START_HERE_WELCOME_LESSON_ID,
} from "@/lib/academy/startHereLessons";
import { syncAcademyLessonTrackedActions } from "@/lib/academy/syncAcademyTrackedActions";
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

  const body = (await request.json().catch(() => ({}))) as { status?: unknown };
  if (!isLessonProgressStatus(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const trimmedCourseId = courseId.trim();
  const trimmedLessonId = lessonId.trim();

  const result = await setLessonProgressStatus({
    userId: authCheck.userId,
    courseId: trimmedCourseId,
    lessonId: trimmedLessonId,
    status: body.status,
    actorId: authCheck.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Completing/uncompleting any Start Here lesson may unlock the Welcome action.
  if (isStartHereLessonId(trimmedLessonId)) {
    try {
      await syncAcademyLessonTrackedActions(
        authCheck.userId,
        START_HERE_COURSE_ID,
        START_HERE_WELCOME_LESSON_ID
      );
    } catch (err) {
      console.error(
        "[lesson-progress] start-here tracked sync:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return NextResponse.json({ status: result.status });
}

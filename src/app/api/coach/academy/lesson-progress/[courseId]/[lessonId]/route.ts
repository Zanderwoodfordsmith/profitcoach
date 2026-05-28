import { NextResponse } from "next/server";

import { setLessonProgressStatus } from "@/lib/academy/lessonProgress";
import { isLessonProgressStatus } from "@/lib/academy/lessonProgressTypes";
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

  const result = await setLessonProgressStatus({
    userId: authCheck.userId,
    courseId: courseId.trim(),
    lessonId: lessonId.trim(),
    status: body.status,
    actorId: authCheck.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ status: result.status });
}

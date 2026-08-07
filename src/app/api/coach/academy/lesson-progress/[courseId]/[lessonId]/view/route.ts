import { NextResponse } from "next/server";

import { touchLessonView } from "@/lib/academy/lessonProgress";
import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";

type Params = { params: Promise<{ courseId: string; lessonId: string }> };

export async function POST(request: Request, { params }: Params) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  const { courseId, lessonId } = await params;
  if (!courseId?.trim() || !lessonId?.trim()) {
    return NextResponse.json({ error: "Missing course or lesson id." }, { status: 400 });
  }

  const result = await touchLessonView({
    userId: authCheck.userId,
    courseId: courseId.trim(),
    lessonId: lessonId.trim(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ viewedAt: result.viewedAt });
}

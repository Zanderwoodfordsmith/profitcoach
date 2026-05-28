import { NextResponse } from "next/server";

import { loadLessonProgressForCourse } from "@/lib/academy/lessonProgress";
import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";

type Params = { params: Promise<{ courseId: string }> };

export async function GET(request: Request, { params }: Params) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;
  if (!courseId?.trim()) {
    return NextResponse.json({ error: "Missing course id." }, { status: 400 });
  }

  const progress = await loadLessonProgressForCourse(authCheck.userId, courseId.trim());
  return NextResponse.json({ progress });
}

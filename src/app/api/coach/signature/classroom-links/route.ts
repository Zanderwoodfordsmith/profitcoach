import { NextResponse } from "next/server";

import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";
import {
  loadLessonProgressForUser,
  loadLessonViewsForUser,
} from "@/lib/academy/lessonProgress";
import {
  classroomHrefForLink,
  resolveAllCompassClassroomLinks,
} from "@/lib/signature/compassClassroomLinks";

/**
 * Resolve Compass outer modules → Classroom lesson URLs.
 * Prefers the most recently viewed incomplete lesson in each category section.
 */
export async function GET(request: Request) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const basePath =
    url.searchParams.get("basePath")?.trim() || "/coach/academy/classroom";

  const [progress, lastViewed] = await Promise.all([
    loadLessonProgressForUser(authCheck.userId),
    loadLessonViewsForUser(authCheck.userId),
  ]);

  const resolved = resolveAllCompassClassroomLinks({ progress, lastViewed });
  const links: Record<string, { courseId: string; lessonId: string; href: string }> =
    {};
  for (const link of resolved) {
    links[link.moduleId] = {
      courseId: link.courseId,
      lessonId: link.lessonId,
      href: classroomHrefForLink(basePath, link),
    };
  }

  return NextResponse.json({ links });
}

import { NextResponse } from "next/server";

import {
  loadLessonProgressForUser,
  loadLessonViewsForUser,
} from "@/lib/academy/lessonProgress";
import {
  loadLessonChapterProgressForUser,
  mergeConsolidatedParentCompletions,
  mergeLegacyLessonProgressIntoChapters,
} from "@/lib/academy/lessonChapterProgress";
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

  // Keyed by lesson id across every programme: hub cards regroup the same
  // lessons under different course ids, and callers only look up their own
  // lesson ids.
  const [rawProgress, lastViewed, rawChapterProgress] = await Promise.all([
    loadLessonProgressForUser(authCheck.userId),
    loadLessonViewsForUser(authCheck.userId),
    loadLessonChapterProgressForUser(authCheck.userId),
  ]);

  // Old standalone lessons that became chapters still store completion under
  // the pre-consolidation lesson id — fold those into chapter + parent ticks.
  const chapterProgress = mergeLegacyLessonProgressIntoChapters(
    rawProgress,
    rawChapterProgress,
  );
  const progress = mergeConsolidatedParentCompletions(rawProgress, chapterProgress);

  return NextResponse.json({ progress, lastViewed, chapterProgress });
}

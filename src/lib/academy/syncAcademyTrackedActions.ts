import {
  evaluateAcademyVerifyRule,
  loadAcademyVerifyContext,
} from "@/lib/academy/academyActionVerify";
import {
  isTrackedRecommendedAction,
  parseRecommendedActions,
  type AcademyRecommendedAction,
} from "@/lib/academy/lessonActions";
import {
  loadAcademyLessonActionItems,
  upsertAcademyRecommendedActions,
  type AcademyLessonActionItem,
} from "@/lib/actionPlans/academyLessonActions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function loadLessonRecommendedActions(
  courseId: string,
  lessonId: string
): Promise<AcademyRecommendedAction[]> {
  const { data, error } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("recommended_actions")
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return parseRecommendedActions(data?.recommended_actions);
}

type RecommendedSyncRow = {
  courseId: string;
  lessonId: string;
  text: string;
  recommendedActionId: string;
  done?: boolean;
  doneSource?: "manual" | "auto" | null;
};

function buildSyncRows(
  courseId: string,
  lessonId: string,
  recommended: AcademyRecommendedAction[],
  verifyContext: Awaited<ReturnType<typeof loadAcademyVerifyContext>> | null
): RecommendedSyncRow[] {
  const rows: RecommendedSyncRow[] = [];
  for (const rec of recommended) {
    if (isTrackedRecommendedAction(rec)) {
      const shouldBeDone = verifyContext
        ? evaluateAcademyVerifyRule(rec.verifyRule!, verifyContext)
        : false;
      rows.push({
        courseId,
        lessonId,
        text: rec.text,
        recommendedActionId: rec.id,
        done: shouldBeDone,
        doneSource: shouldBeDone ? "auto" : null,
      });
      continue;
    }
    rows.push({
      courseId,
      lessonId,
      text: rec.text,
      recommendedActionId: rec.id,
    });
  }
  return rows;
}

/**
 * Upsert recommended actions for a lesson.
 * Manual actions appear as open todos; tracked ones follow verify rules.
 */
export async function syncAcademyLessonTrackedActions(
  coachId: string,
  courseId: string,
  lessonId: string
): Promise<AcademyLessonActionItem[]> {
  const recommended = await loadLessonRecommendedActions(courseId, lessonId);
  if (recommended.length === 0) {
    return loadAcademyLessonActionItems(coachId, courseId, lessonId);
  }

  const needsVerify = recommended.some(isTrackedRecommendedAction);
  const context = needsVerify ? await loadAcademyVerifyContext(coachId) : null;
  await upsertAcademyRecommendedActions(
    coachId,
    buildSyncRows(courseId, lessonId, recommended, context)
  );

  return loadAcademyLessonActionItems(coachId, courseId, lessonId);
}

/** True when this recommended action id is tracked for the given lesson. */
export async function isAcademyRecommendedActionTracked(
  courseId: string,
  lessonId: string,
  recommendedActionId: string
): Promise<boolean> {
  const recommended = await loadLessonRecommendedActions(courseId, lessonId);
  const match = recommended.find((action) => action.id === recommendedActionId);
  return match ? isTrackedRecommendedAction(match) : false;
}

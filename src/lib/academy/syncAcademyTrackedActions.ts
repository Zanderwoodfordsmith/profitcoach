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
  dedupeAcademyRecommendedActionItems,
  loadAcademyLessonActionItems,
  reorganizeClassroomActionGroups,
  upsertAcademyRecommendedActions,
  type AcademyLessonActionItem,
} from "@/lib/actionPlans/academyLessonActions";
import {
  classroomActionPathTitleForLesson,
  pathUsesSubgroups,
} from "@/lib/actionPlans/classroomActionGroups";
import { CLASSROOM_PATH_CARD_GROUPS } from "@/lib/actionPlans/classroomActionGroupMeta";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CLASSROOM_CONTENT_COURSE_IDS = [
  "kickstart",
  "coach-action-plan",
  "going-pro",
  "client-acquisition",
  "client-delivery",
  "profit-coach-certification",
  "profit-coach-os",
] as const;

const PATH_TITLE_TO_ID = new Map(
  CLASSROOM_PATH_CARD_GROUPS.map((group) => [group.title, group.id])
);

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

type ContentLessonRow = {
  course_id: string;
  lesson_id: string;
  recommended_actions: unknown;
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

function expectedActionKey(courseId: string, lessonId: string, actionId: string) {
  return `${courseId}|${lessonId}|${actionId}`;
}

async function loadClassroomRecommendedLessons(): Promise<ContentLessonRow[]> {
  const { data, error } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("course_id, lesson_id, recommended_actions")
    .in("course_id", [...CLASSROOM_CONTENT_COURSE_IDS])
    .or("is_draft.is.null,is_draft.eq.false")
    .or("is_deleted.is.null,is_deleted.eq.false");
  if (error) throw new Error(error.message);
  return ((data ?? []) as ContentLessonRow[]).filter(
    (row) => parseRecommendedActions(row.recommended_actions).length > 0
  );
}

function buildExpectedKeys(lessons: ContentLessonRow[]): Set<string> {
  const keys = new Set<string>();
  for (const row of lessons) {
    const courseId = String(row.course_id ?? "");
    const lessonId = String(row.lesson_id ?? "");
    if (!courseId || !lessonId) continue;
    for (const action of parseRecommendedActions(row.recommended_actions)) {
      keys.add(expectedActionKey(courseId, lessonId, action.id));
    }
  }
  return keys;
}

/**
 * Upsert recommended actions for a lesson into My Actions.
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

const syncAllLocks = new Map<string, Promise<void>>();

/**
 * Seed missing classroom recommended actions, then nest/reorder only when needed.
 * Skips heavy work on subsequent My Actions loads once the coach is up to date.
 */
export async function ensureClassroomActionsOnLoad(
  coachId: string
): Promise<void> {
  const existing = syncAllLocks.get(coachId);
  if (existing) {
    await existing;
    return;
  }

  const run = (async () => {
    const [lessons, coachRows] = await Promise.all([
      loadClassroomRecommendedLessons(),
      supabaseAdmin
        .from("coach_action_items")
        .select(
          "academy_course_id, academy_lesson_id, academy_recommended_action_id, depth"
        )
        .eq("coach_id", coachId)
        .not("academy_recommended_action_id", "is", null),
    ]);

    if (coachRows.error) throw new Error(coachRows.error.message);

    const expectedKeys = buildExpectedKeys(lessons);
    const existingKeys = new Set<string>();
    let nestingOk = true;

    for (const row of coachRows.data ?? []) {
      const courseId = String(row.academy_course_id ?? "");
      const lessonId = String(row.academy_lesson_id ?? "");
      const recommendedId = String(row.academy_recommended_action_id ?? "");
      if (!courseId || !lessonId || !recommendedId) continue;
      existingKeys.add(expectedActionKey(courseId, lessonId, recommendedId));

      const pathTitle = classroomActionPathTitleForLesson(courseId, lessonId);
      const pathId = PATH_TITLE_TO_ID.get(pathTitle as (typeof CLASSROOM_PATH_CARD_GROUPS)[number]["title"]);
      const depth = typeof row.depth === "number" ? row.depth : 1;
      if (pathId && pathUsesSubgroups(pathId)) {
        if (depth !== 2) nestingOk = false;
      } else if (depth !== 1) {
        nestingOk = false;
      }
    }

    let missing = 0;
    for (const key of expectedKeys) {
      if (!existingKeys.has(key)) missing += 1;
    }

    if (missing === 0 && nestingOk) {
      return;
    }

    if (missing > 0) {
      await dedupeAcademyRecommendedActionItems(coachId);

      const needsVerify = lessons.some((row) =>
        parseRecommendedActions(row.recommended_actions).some(
          isTrackedRecommendedAction
        )
      );
      const context = needsVerify
        ? await loadAcademyVerifyContext(coachId)
        : null;

      const rows: RecommendedSyncRow[] = [];
      for (const row of lessons) {
        const courseId = String(row.course_id ?? "");
        const lessonId = String(row.lesson_id ?? "");
        if (!courseId || !lessonId) continue;
        rows.push(
          ...buildSyncRows(
            courseId,
            lessonId,
            parseRecommendedActions(row.recommended_actions),
            context
          )
        );
      }

      await upsertAcademyRecommendedActions(coachId, rows, {
        reorganize: false,
      });
      await dedupeAcademyRecommendedActionItems(coachId);
    }

    await reorganizeClassroomActionGroups(coachId);
  })();

  syncAllLocks.set(coachId, run);
  try {
    await run;
  } finally {
    if (syncAllLocks.get(coachId) === run) {
      syncAllLocks.delete(coachId);
    }
  }
}

/** @deprecated Prefer ensureClassroomActionsOnLoad for My Actions GET. */
export async function syncAllAcademyRecommendedActions(
  coachId: string
): Promise<void> {
  await ensureClassroomActionsOnLoad(coachId);
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

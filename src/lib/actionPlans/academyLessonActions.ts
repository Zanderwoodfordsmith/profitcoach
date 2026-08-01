import type { SupabaseClient } from "@supabase/supabase-js";
import { createOutlineLine } from "@/lib/actionPlans/actionOutlineUtils";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const ACADEMY_ACTIONS_GROUP_TEXT = "Academy";

export type AcademyLessonActionItem = {
  id: string;
  text: string;
  done: boolean;
  recommendedActionId: string | null;
};

type DbActionItem = {
  id: string;
  text: string;
  depth: number;
  sort_order: number;
  done: boolean;
  academy_course_id: string | null;
  academy_lesson_id: string | null;
  academy_recommended_action_id: string | null;
};

function toLessonAction(row: DbActionItem): AcademyLessonActionItem {
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    recommendedActionId: row.academy_recommended_action_id,
  };
}

async function loadCoachActionItems(coachId: string): Promise<DbActionItem[]> {
  const { data, error } = await supabaseAdmin
    .from("coach_action_items")
    .select(
      "id, text, depth, sort_order, done, academy_course_id, academy_lesson_id, academy_recommended_action_id"
    )
    .eq("coach_id", coachId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as DbActionItem[];
}

function findAcademyGroupIndex(items: DbActionItem[]): number {
  return items.findIndex(
    (item) => item.depth === 0 && item.text === ACADEMY_ACTIONS_GROUP_TEXT
  );
}

function lastChildIndex(items: DbActionItem[], groupIndex: number): number {
  let last = groupIndex;
  for (let i = groupIndex + 1; i < items.length; i += 1) {
    if (items[i].depth === 0) break;
    last = i;
  }
  return last;
}

async function ensureAcademyGroup(
  coachId: string,
  items: DbActionItem[]
): Promise<{ items: DbActionItem[]; groupIndex: number }> {
  const existingIndex = findAcademyGroupIndex(items);
  if (existingIndex >= 0) {
    return { items, groupIndex: existingIndex };
  }

  const line = createOutlineLine(ACADEMY_ACTIONS_GROUP_TEXT, 0);
  const sortOrder = items.length
    ? Math.max(...items.map((item) => item.sort_order)) + 1
    : 0;
  const { data, error } = await supabaseAdmin
    .from("coach_action_items")
    .insert({
      id: line.id,
      coach_id: coachId,
      text: ACADEMY_ACTIONS_GROUP_TEXT,
      depth: 0,
      sort_order: sortOrder,
      estimate: "",
      recurrence: "none",
      done: false,
      is_locked: false,
    })
    .select(
      "id, text, depth, sort_order, done, academy_course_id, academy_lesson_id, academy_recommended_action_id"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create Academy actions group.");
  }
  const nextItems = [...items, data as DbActionItem];
  return { items: nextItems, groupIndex: nextItems.length - 1 };
}

async function reindexSortOrders(coachId: string, items: DbActionItem[]) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.sort_order === index) continue;
    await supabaseAdmin
      .from("coach_action_items")
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("coach_id", coachId);
    item.sort_order = index;
  }
}

export async function loadAcademyLessonActionItems(
  coachId: string,
  courseId: string,
  lessonId: string
): Promise<AcademyLessonActionItem[]> {
  const { data, error } = await supabaseAdmin
    .from("coach_action_items")
    .select(
      "id, text, depth, sort_order, done, academy_course_id, academy_lesson_id, academy_recommended_action_id"
    )
    .eq("coach_id", coachId)
    .eq("academy_course_id", courseId)
    .eq("academy_lesson_id", lessonId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as DbActionItem[]).map(toLessonAction);
}

/** Load via caller’s supabase client when RLS applies (optional alternate). */
export async function loadAcademyLessonActionItemsWithClient(
  supabase: SupabaseClient,
  coachId: string,
  courseId: string,
  lessonId: string
): Promise<AcademyLessonActionItem[]> {
  const { data, error } = await supabase
    .from("coach_action_items")
    .select(
      "id, text, depth, sort_order, done, academy_course_id, academy_lesson_id, academy_recommended_action_id"
    )
    .eq("coach_id", coachId)
    .eq("academy_course_id", courseId)
    .eq("academy_lesson_id", lessonId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as DbActionItem[]).map(toLessonAction);
}

export async function addAcademyLessonAction(
  coachId: string,
  input: {
    courseId: string;
    lessonId: string;
    text: string;
    recommendedActionId?: string | null;
    done?: boolean;
  }
): Promise<AcademyLessonActionItem> {
  const trimmedText = input.text.trim();
  if (!trimmedText) {
    throw new Error("Action text is required.");
  }

  let items = await loadCoachActionItems(coachId);

  if (input.recommendedActionId) {
    const existing = items.find(
      (item) =>
        item.academy_course_id === input.courseId &&
        item.academy_lesson_id === input.lessonId &&
        item.academy_recommended_action_id === input.recommendedActionId
    );
    if (existing) {
      if (
        existing.text !== trimmedText ||
        (input.done !== undefined && existing.done !== input.done)
      ) {
        const nextDone = input.done ?? existing.done;
        const { data, error } = await supabaseAdmin
          .from("coach_action_items")
          .update({
            text: trimmedText,
            done: nextDone,
            done_at: nextDone ? new Date().toISOString() : null,
            done_source: nextDone ? "manual" : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("coach_id", coachId)
          .select(
            "id, text, depth, sort_order, done, academy_course_id, academy_lesson_id, academy_recommended_action_id"
          )
          .single();
        if (error || !data) {
          throw new Error(error?.message ?? "Failed to update action.");
        }
        return toLessonAction(data as DbActionItem);
      }
      return toLessonAction(existing);
    }
  }

  const ensured = await ensureAcademyGroup(coachId, items);
  items = ensured.items;
  const insertAfter = lastChildIndex(items, ensured.groupIndex);
  const insertSortOrder = insertAfter + 1;

  for (const item of items) {
    if (item.sort_order >= insertSortOrder) {
      item.sort_order += 1;
    }
  }

  const done = Boolean(input.done);
  const line = createOutlineLine(trimmedText, 1);
  const { data, error } = await supabaseAdmin
    .from("coach_action_items")
    .insert({
      id: line.id,
      coach_id: coachId,
      text: trimmedText,
      depth: 1,
      sort_order: insertSortOrder,
      estimate: "",
      recurrence: "none",
      done,
      done_at: done ? new Date().toISOString() : null,
      done_source: done ? "manual" : null,
      is_locked: false,
      academy_course_id: input.courseId,
      academy_lesson_id: input.lessonId,
      academy_recommended_action_id: input.recommendedActionId ?? null,
    })
    .select(
      "id, text, depth, sort_order, done, academy_course_id, academy_lesson_id, academy_recommended_action_id"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create action.");
  }

  items.splice(insertAfter + 1, 0, data as DbActionItem);
  await reindexSortOrders(coachId, items);

  return toLessonAction(data as DbActionItem);
}

export async function setAcademyLessonActionDone(
  coachId: string,
  actionId: string,
  done: boolean
): Promise<AcademyLessonActionItem> {
  const { data, error } = await supabaseAdmin
    .from("coach_action_items")
    .update({
      done,
      done_at: done ? new Date().toISOString() : null,
      done_source: done ? "manual" : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", actionId)
    .eq("coach_id", coachId)
    .eq("is_locked", false)
    .select(
      "id, text, depth, sort_order, done, academy_course_id, academy_lesson_id, academy_recommended_action_id"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update action.");
  }
  return toLessonAction(data as DbActionItem);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRecommendedActions } from "@/lib/academy/lessonActions";
import { createOutlineLine } from "@/lib/actionPlans/actionOutlineUtils";
import {
  ACADEMY_ACTIONS_GROUP_TEXT,
  CLASSROOM_PATH_CARD_GROUPS,
  buildClassroomLessonOrderIndex,
  classroomActionPathTitleForLesson,
  classroomActionSubgroupTitleForLesson,
  isClassroomActionGroupTitle,
  isKnownClassroomSubgroupTitle,
  listSubgroupTitlesForPath,
  pathUsesSubgroups,
} from "@/lib/actionPlans/classroomActionGroups";
import { PROSPECT_FOLLOWUP_GROUP_TEXT } from "@/lib/actionPlans/prospectFollowUp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export { ACADEMY_ACTIONS_GROUP_TEXT } from "@/lib/actionPlans/classroomActionGroups";

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
  is_locked?: boolean;
  assignment_id?: string | null;
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
      "id, text, depth, sort_order, done, is_locked, assignment_id, academy_course_id, academy_lesson_id, academy_recommended_action_id"
    )
    .eq("coach_id", coachId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as DbActionItem[];
}

function findGroupIndex(items: DbActionItem[], groupText: string): number {
  return items.findIndex(
    (item) => item.depth === 0 && item.text === groupText && !item.assignment_id
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

async function ensureClassroomGroup(
  coachId: string,
  items: DbActionItem[],
  groupText: string
): Promise<{ items: DbActionItem[]; groupIndex: number }> {
  const existingIndex = findGroupIndex(items, groupText);
  if (existingIndex >= 0) {
    return { items, groupIndex: existingIndex };
  }

  const line = createOutlineLine(groupText, 0);
  const sortOrder = items.length
    ? Math.max(...items.map((item) => item.sort_order)) + 1
    : 0;
  const { data, error } = await supabaseAdmin
    .from("coach_action_items")
    .insert({
      id: line.id,
      coach_id: coachId,
      text: groupText,
      depth: 0,
      sort_order: sortOrder,
      estimate: "",
      recurrence: "none",
      done: false,
      is_locked: false,
    })
    .select(
      "id, text, depth, sort_order, done, is_locked, assignment_id, academy_course_id, academy_lesson_id, academy_recommended_action_id"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create classroom actions group.");
  }
  const nextItems = [...items, data as DbActionItem];
  return { items: nextItems, groupIndex: nextItems.length - 1 };
}

async function persistSortAndDepth(
  coachId: string,
  items: DbActionItem[],
  previousDepthById: Map<string, number>
) {
  const now = new Date().toISOString();
  const pending = items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item, index }) =>
        item.sort_order !== index || previousDepthById.get(item.id) !== item.depth
    );
  if (!pending.length) return;

  const chunkSize = 80;
  for (let i = 0; i < pending.length; i += chunkSize) {
    const chunk = pending.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(({ item, index }) =>
        supabaseAdmin
          .from("coach_action_items")
          .update({
            sort_order: index,
            depth: item.depth,
            updated_at: now,
          })
          .eq("id", item.id)
          .eq("coach_id", coachId)
      )
    );
    for (const { item, index } of chunk) {
      item.sort_order = index;
    }
  }
}

async function reindexSortOrders(coachId: string, items: DbActionItem[]) {
  const previousDepthById = new Map(
    items.map((item) => [item.id, item.depth] as const)
  );
  await persistSortAndDepth(coachId, items, previousDepthById);
}

function isAcademyLinked(item: DbActionItem): boolean {
  return Boolean(item.academy_course_id || item.academy_lesson_id);
}

function isClassroomHeader(text: string): boolean {
  return isClassroomActionGroupTitle(text);
}

async function loadRecommendedActionOrderIndex(
  lessonIds: string[]
): Promise<Map<string, number>> {
  const unique = [...new Set(lessonIds.filter(Boolean))];
  const map = new Map<string, number>();
  if (!unique.length) return map;

  const chunkSize = 80;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin
      .from("academy_lesson_content")
      .select("lesson_id, recommended_actions")
      .in("lesson_id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const lessonId = String(row.lesson_id ?? "");
      if (!lessonId) continue;
      const actions = parseRecommendedActions(row.recommended_actions);
      actions.forEach((action, index) => {
        map.set(`${lessonId}|${action.id}`, index);
      });
    }
  }
  return map;
}

function sortAcademyChildren(
  children: DbActionItem[],
  lessonOrder: Map<string, number>,
  actionOrder: Map<string, number>
): DbActionItem[] {
  return [...children].sort((a, b) => {
    const aLesson = a.academy_lesson_id ?? "";
    const bLesson = b.academy_lesson_id ?? "";
    const lessonDiff =
      (lessonOrder.get(aLesson) ?? Number.MAX_SAFE_INTEGER) -
      (lessonOrder.get(bLesson) ?? Number.MAX_SAFE_INTEGER);
    if (lessonDiff !== 0) return lessonDiff;

    const aAction =
      actionOrder.get(`${aLesson}|${a.academy_recommended_action_id ?? ""}`) ??
      Number.MAX_SAFE_INTEGER;
    const bAction =
      actionOrder.get(`${bLesson}|${b.academy_recommended_action_id ?? ""}`) ??
      Number.MAX_SAFE_INTEGER;
    if (aAction !== bAction) return aAction - bAction;

    return a.sort_order - b.sort_order;
  });
}

/**
 * Remove duplicate academy recommended rows (same lesson + recommended id).
 * Keeps a done row when present, otherwise the earliest sort_order.
 */
export async function dedupeAcademyRecommendedActionItems(
  coachId: string
): Promise<number> {
  const items = await loadCoachActionItems(coachId);
  const groups = new Map<string, DbActionItem[]>();

  for (const item of items) {
    if (!item.academy_lesson_id || !item.academy_recommended_action_id) continue;
    const key = `${item.academy_lesson_id}|${item.academy_recommended_action_id}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const toDelete: string[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => {
      if (a.done !== b.done) return a.done ? -1 : 1;
      return a.sort_order - b.sort_order;
    });
    for (const extra of group.slice(1)) {
      toDelete.push(extra.id);
    }
  }

  if (!toDelete.length) return 0;

  const chunkSize = 80;
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const chunk = toDelete.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin
      .from("coach_action_items")
      .delete()
      .eq("coach_id", coachId)
      .in("id", chunk)
      .eq("is_locked", false);
    if (error) throw new Error(error.message);
  }

  return toDelete.length;
}

/**
 * Move academy-linked rows into Classroom path groups (Start Here, Get Calls, …)
 * with section/lesson subgroups under Get Calls, Win Clients, Coach Clients, and
 * Going Pro. Safe to call on every My Actions load.
 */
export async function reorganizeClassroomActionGroups(
  coachId: string
): Promise<boolean> {
  const original = await loadCoachActionItems(coachId);
  if (!original.length) return false;

  const previousDepthById = new Map(
    original.map((item) => [item.id, item.depth] as const)
  );

  const pathHeadersByTitle = new Map<string, DbActionItem>();
  const subgroupHeadersByKey = new Map<string, DbActionItem>();
  const academyByPath = new Map<string, DbActionItem[]>();
  const looseUnderPath = new Map<string, DbActionItem[]>();
  const otherBlocks: DbActionItem[][] = [];
  const assignedBlocks: DbActionItem[][] = [];
  const headersToDelete: DbActionItem[] = [];
  const seenAcademyIds = new Set<string>();

  const pushAcademy = (item: DbActionItem) => {
    if (seenAcademyIds.has(item.id)) return;
    seenAcademyIds.add(item.id);
    const pathTitle = classroomActionPathTitleForLesson(
      item.academy_course_id ?? "",
      item.academy_lesson_id ?? ""
    );
    const list = academyByPath.get(pathTitle) ?? [];
    list.push(item);
    academyByPath.set(pathTitle, list);
  };

  for (let i = 0; i < original.length; ) {
    const item = original[i];
    if (item.depth !== 0) {
      if (isAcademyLinked(item)) pushAcademy(item);
      else otherBlocks.push([item]);
      i += 1;
      continue;
    }

    const end = lastChildIndex(original, i);
    const header = item;
    const children = original.slice(i + 1, end + 1);
    i = end + 1;

    if (header.assignment_id || header.is_locked) {
      assignedBlocks.push([header, ...children]);
      continue;
    }

    // Former top-level section headers (from a brief flat regroup) → absorb.
    if (isKnownClassroomSubgroupTitle(header.text) && !isClassroomHeader(header.text)) {
      headersToDelete.push(header);
      for (const child of children) {
        if (isAcademyLinked(child)) pushAcademy(child);
      }
      continue;
    }

    if (isClassroomHeader(header.text)) {
      if (!pathHeadersByTitle.has(header.text)) {
        pathHeadersByTitle.set(header.text, header);
      } else {
        headersToDelete.push(header);
      }

      for (let c = 0; c < children.length; ) {
        const child = children[c];
        if (isAcademyLinked(child)) {
          pushAcademy(child);
          c += 1;
          continue;
        }

        // Subgroup header (depth 1, no academy link) with optional depth-2 actions.
        if (
          child.depth === 1 &&
          !isAcademyLinked(child) &&
          (isKnownClassroomSubgroupTitle(child.text) ||
            children[c + 1]?.depth === 2)
        ) {
          const key = `${header.text}\0${child.text}`;
          if (!subgroupHeadersByKey.has(key)) {
            subgroupHeadersByKey.set(key, child);
          } else {
            headersToDelete.push(child);
          }
          c += 1;
          while (c < children.length && children[c].depth >= 2) {
            if (isAcademyLinked(children[c])) pushAcademy(children[c]);
            c += 1;
          }
          continue;
        }

        const loose = looseUnderPath.get(header.text) ?? [];
        loose.push(child);
        looseUnderPath.set(header.text, loose);
        c += 1;
      }
      continue;
    }

    const keptChildren: DbActionItem[] = [];
    for (const child of children) {
      if (isAcademyLinked(child)) {
        pushAcademy(child);
        continue;
      }
      keptChildren.push(child);
    }

    if (header.text === ACADEMY_ACTIONS_GROUP_TEXT && keptChildren.length === 0) {
      headersToDelete.push(header);
      continue;
    }

    if (header.text === PROSPECT_FOLLOWUP_GROUP_TEXT) {
      otherBlocks.unshift([header, ...keptChildren]);
    } else {
      otherBlocks.push([header, ...keptChildren]);
    }
  }

  let lessonOrder = new Map<string, number>();
  try {
    lessonOrder = buildClassroomLessonOrderIndex();
  } catch {
    lessonOrder = new Map();
  }

  const allAcademy = [...academyByPath.values()].flat();
  const actionOrder = await loadRecommendedActionOrderIndex(
    allAcademy
      .map((row) => row.academy_lesson_id)
      .filter((id): id is string => Boolean(id))
  );

  let knownItems = [...original];
  const next: DbActionItem[] = [];

  const ensurePathHeader = async (title: string): Promise<DbActionItem> => {
    const existing = pathHeadersByTitle.get(title);
    if (existing) {
      existing.depth = 0;
      return existing;
    }
    const ensured = await ensureClassroomGroup(coachId, knownItems, title);
    knownItems = ensured.items;
    const header = ensured.items[ensured.groupIndex];
    header.depth = 0;
    pathHeadersByTitle.set(title, header);
    return header;
  };

  const ensureSubgroupHeader = async (
    pathTitle: string,
    subgroupTitle: string
  ): Promise<DbActionItem> => {
    const key = `${pathTitle}\0${subgroupTitle}`;
    const existing = subgroupHeadersByKey.get(key);
    if (existing) {
      existing.depth = 1;
      existing.text = subgroupTitle;
      return existing;
    }

    const line = createOutlineLine(subgroupTitle, 1);
    const { data, error } = await supabaseAdmin
      .from("coach_action_items")
      .insert({
        id: line.id,
        coach_id: coachId,
        text: subgroupTitle,
        depth: 1,
        sort_order: knownItems.length,
        estimate: "",
        recurrence: "none",
        done: false,
        is_locked: false,
      })
      .select(
        "id, text, depth, sort_order, done, is_locked, assignment_id, academy_course_id, academy_lesson_id, academy_recommended_action_id"
      )
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create subgroup header.");
    }
    const header = data as DbActionItem;
    knownItems = [...knownItems, header];
    subgroupHeadersByKey.set(key, header);
    return header;
  };

  for (const path of CLASSROOM_PATH_CARD_GROUPS) {
    const pathActions = academyByPath.get(path.title) ?? [];
    const loose = looseUnderPath.get(path.title) ?? [];
    if (!pathActions.length && !loose.length) {
      const emptyHeader = pathHeadersByTitle.get(path.title);
      if (emptyHeader) headersToDelete.push(emptyHeader);
      academyByPath.delete(path.title);
      continue;
    }

    const pathHeader = await ensurePathHeader(path.title);
    next.push(pathHeader);

    if (pathUsesSubgroups(path.id) && pathActions.length) {
      const bySubgroup = new Map<string, DbActionItem[]>();
      for (const action of pathActions) {
        const subgroup =
          classroomActionSubgroupTitleForLesson(
            action.academy_course_id ?? "",
            action.academy_lesson_id ?? ""
          ) ?? "Other";
        const list = bySubgroup.get(subgroup) ?? [];
        list.push(action);
        bySubgroup.set(subgroup, list);
      }

      const orderedSubgroups = [
        ...listSubgroupTitlesForPath(path.id),
        ...[...bySubgroup.keys()].filter(
          (title) => !listSubgroupTitlesForPath(path.id).includes(title)
        ),
      ];

      for (const subgroupTitle of orderedSubgroups) {
        const actions = bySubgroup.get(subgroupTitle);
        if (!actions?.length) continue;
        const subgroupHeader = await ensureSubgroupHeader(
          path.title,
          subgroupTitle
        );
        next.push(subgroupHeader);
        const sorted = sortAcademyChildren(actions, lessonOrder, actionOrder);
        for (const action of sorted) {
          action.depth = 2;
          next.push(action);
        }
        bySubgroup.delete(subgroupTitle);
      }
    } else {
      const sorted = sortAcademyChildren(pathActions, lessonOrder, actionOrder);
      for (const action of sorted) {
        action.depth = 1;
        next.push(action);
      }
    }

    for (const item of loose) {
      item.depth = Math.max(1, item.depth);
      next.push(item);
    }

    academyByPath.delete(path.title);
  }

  for (const [pathTitle, actions] of academyByPath) {
    if (!actions.length) continue;
    const pathHeader = await ensurePathHeader(pathTitle);
    next.push(pathHeader);
    const sorted = sortAcademyChildren(actions, lessonOrder, actionOrder);
    for (const action of sorted) {
      action.depth = 1;
      next.push(action);
    }
  }

  // Unused subgroup headers
  const usedSubgroupIds = new Set(
    next.filter((item) => !isAcademyLinked(item) && item.depth === 1).map((item) => item.id)
  );
  for (const header of subgroupHeadersByKey.values()) {
    if (!usedSubgroupIds.has(header.id) && !next.some((item) => item.id === header.id)) {
      headersToDelete.push(header);
    }
  }

  for (const block of otherBlocks) next.push(...block);
  for (const block of assignedBlocks) next.push(...block);

  const seen = new Set<string>();
  const deduped: DbActionItem[] = [];
  for (const item of next) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  const changed =
    headersToDelete.some((header) => !seen.has(header.id)) ||
    deduped.length !== original.length ||
    deduped.some(
      (item, index) =>
        item.id !== original[index]?.id ||
        item.depth !== previousDepthById.get(item.id)
    );

  if (!changed) return false;

  for (const header of headersToDelete) {
    if (seen.has(header.id)) continue;
    await supabaseAdmin
      .from("coach_action_items")
      .delete()
      .eq("id", header.id)
      .eq("coach_id", coachId)
      .eq("is_locked", false);
  }

  await persistSortAndDepth(coachId, deduped, previousDepthById);
  return true;
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
    /** Defaults to `manual` when marking done. Use `auto` for tracked verify sync. */
    doneSource?: "manual" | "auto" | null;
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
        const nextSource = nextDone ? (input.doneSource ?? "manual") : null;
        const { data, error } = await supabaseAdmin
          .from("coach_action_items")
          .update({
            text: trimmedText,
            done: nextDone,
            done_at: nextDone ? new Date().toISOString() : null,
            done_source: nextSource,
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

  const groupTitle = classroomActionPathTitleForLesson(
    input.courseId,
    input.lessonId
  );
  const ensured = await ensureClassroomGroup(coachId, items, groupTitle);
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
      done_source: done ? (input.doneSource ?? "manual") : null,
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
  await reorganizeClassroomActionGroups(coachId);

  return toLessonAction(data as DbActionItem);
}

/**
 * Ensure recommended lesson actions exist as My Actions rows.
 * Missing rows are created incomplete (or with the given done state).
 * Existing rows keep their done flag unless `done` is provided.
 */
export async function upsertAcademyRecommendedActions(
  coachId: string,
  rows: Array<{
    courseId: string;
    lessonId: string;
    text: string;
    recommendedActionId: string;
    done?: boolean;
    doneSource?: "manual" | "auto" | null;
  }>,
  options?: { reorganize?: boolean }
): Promise<void> {
  if (!rows.length) return;

  let items = await loadCoachActionItems(coachId);
  const byKey = new Map<string, DbActionItem>();
  for (const item of items) {
    if (
      !item.academy_course_id ||
      !item.academy_lesson_id ||
      !item.academy_recommended_action_id
    ) {
      continue;
    }
    byKey.set(
      `${item.academy_course_id}|${item.academy_lesson_id}|${item.academy_recommended_action_id}`,
      item
    );
  }

  type PendingUpdate = {
    id: string;
    text: string;
    done?: boolean;
    doneSource?: "manual" | "auto" | null;
    clearDone: boolean;
  };
  type PendingCreate = {
    courseId: string;
    lessonId: string;
    text: string;
    recommendedActionId: string;
    done: boolean;
    doneSource: "manual" | "auto" | null;
    groupTitle: string;
  };

  const pendingUpdates: PendingUpdate[] = [];
  const pendingCreates: PendingCreate[] = [];

  for (const row of rows) {
    const text = row.text.trim();
    if (!text || !row.recommendedActionId) continue;
    const key = `${row.courseId}|${row.lessonId}|${row.recommendedActionId}`;
    const existing = byKey.get(key);

    if (existing) {
      const nextDone =
        row.done !== undefined ? Boolean(row.done) : existing.done;
      const shouldUpdateDone =
        row.done !== undefined && existing.done !== nextDone;
      const shouldUpdateText = existing.text !== text;
      if (!shouldUpdateDone && !shouldUpdateText) continue;

      pendingUpdates.push({
        id: existing.id,
        text,
        ...(shouldUpdateDone
          ? {
              done: nextDone,
              doneSource: nextDone ? (row.doneSource ?? "manual") : null,
              clearDone: !nextDone,
            }
          : { clearDone: false }),
      });
      // Keep local map in sync so duplicate rows in `rows` don't double-update.
      byKey.set(key, {
        ...existing,
        text,
        done: shouldUpdateDone ? nextDone : existing.done,
      });
      continue;
    }

    // Deduplicate creates if the same recommended id appears twice.
    if (pendingCreates.some((c) => `${c.courseId}|${c.lessonId}|${c.recommendedActionId}` === key)) {
      continue;
    }

    const done = Boolean(row.done);
    pendingCreates.push({
      courseId: row.courseId,
      lessonId: row.lessonId,
      text,
      recommendedActionId: row.recommendedActionId,
      done,
      doneSource: done ? (row.doneSource ?? "manual") : null,
      groupTitle: classroomActionPathTitleForLesson(row.courseId, row.lessonId),
    });
  }

  if (!pendingUpdates.length && !pendingCreates.length) return;

  const now = new Date().toISOString();
  const updateChunkSize = 40;
  for (let i = 0; i < pendingUpdates.length; i += updateChunkSize) {
    const chunk = pendingUpdates.slice(i, i + updateChunkSize);
    await Promise.all(
      chunk.map((update) =>
        supabaseAdmin
          .from("coach_action_items")
          .update({
            text: update.text,
            ...(update.done !== undefined
              ? {
                  done: update.done,
                  done_at: update.clearDone ? null : now,
                  done_source: update.doneSource ?? null,
                }
              : {}),
            updated_at: now,
          })
          .eq("id", update.id)
          .eq("coach_id", coachId)
      )
    );
  }

  if (pendingCreates.length) {
    const createsByGroup = new Map<string, PendingCreate[]>();
    for (const create of pendingCreates) {
      const list = createsByGroup.get(create.groupTitle) ?? [];
      list.push(create);
      createsByGroup.set(create.groupTitle, list);
    }

    for (const [groupTitle, creates] of createsByGroup) {
      const ensured = await ensureClassroomGroup(coachId, items, groupTitle);
      items = ensured.items;
      const insertAfter = lastChildIndex(items, ensured.groupIndex);
      let nextSort = insertAfter + 1;

      const insertRows = creates.map((create) => {
        const line = createOutlineLine(create.text, 1);
        const sortOrder = nextSort;
        nextSort += 1;
        return {
          id: line.id,
          coach_id: coachId,
          text: create.text,
          depth: 1,
          sort_order: sortOrder,
          estimate: "",
          recurrence: "none",
          done: create.done,
          done_at: create.done ? now : null,
          done_source: create.doneSource,
          is_locked: false,
          academy_course_id: create.courseId,
          academy_lesson_id: create.lessonId,
          academy_recommended_action_id: create.recommendedActionId,
        };
      });

      // Shift later items' sort_order in memory; reindex writes them once.
      const shiftBy = insertRows.length;
      for (const item of items) {
        if (item.sort_order >= insertAfter + 1) {
          item.sort_order += shiftBy;
        }
      }

      const { data, error } = await supabaseAdmin
        .from("coach_action_items")
        .insert(insertRows)
        .select(
          "id, text, depth, sort_order, done, is_locked, assignment_id, academy_course_id, academy_lesson_id, academy_recommended_action_id"
        );
      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create recommended actions.");
      }

      items.splice(insertAfter + 1, 0, ...(data as DbActionItem[]));
      for (const created of data as DbActionItem[]) {
        if (
          created.academy_course_id &&
          created.academy_lesson_id &&
          created.academy_recommended_action_id
        ) {
          byKey.set(
            `${created.academy_course_id}|${created.academy_lesson_id}|${created.academy_recommended_action_id}`,
            created
          );
        }
      }
    }
  }

  await reindexSortOrders(coachId, items);
  if (options?.reorganize !== false) {
    await reorganizeClassroomActionGroups(coachId);
  }
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

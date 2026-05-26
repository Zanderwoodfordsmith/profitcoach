import type { SupabaseClient } from "@supabase/supabase-js";
import { createOutlineLine } from "@/lib/actionPlans/actionOutlineUtils";
import { fromDatetimeLocalValue } from "@/lib/actionPlans/mappers";
import { isMissingColumnError } from "@/lib/contactsSchemaSafeSelect";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const PROSPECT_FOLLOWUP_GROUP_TEXT = "Prospect follow-up";

export type ProspectNextAction = {
  id: string;
  text: string;
  dueAt: string | null;
};

type DbActionItem = {
  id: string;
  text: string;
  depth: number;
  sort_order: number;
  due_at: string | null;
  contact_id: string | null;
  done: boolean;
};

function toDateOnlyValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export function dbActionToProspectNextAction(row: DbActionItem): ProspectNextAction {
  return {
    id: row.id,
    text: row.text,
    dueAt: toDateOnlyValue(row.due_at),
  };
}

export async function loadProspectNextActionsByCoach(
  supabase: SupabaseClient,
  coachId: string,
  contactIds: string[]
): Promise<Record<string, ProspectNextAction>> {
  if (!contactIds.length) return {};

  const { data, error } = await supabase
    .from("coach_action_items")
    .select("id, text, depth, sort_order, due_at, contact_id, done")
    .eq("coach_id", coachId)
    .in("contact_id", contactIds)
    .eq("done", false);

  if (error) {
    if (error.code === "42P01" || isMissingColumnError(error)) {
      return {};
    }
    console.warn(
      "loadProspectNextActionsByCoach:",
      error.message ?? error.code ?? error
    );
    return {};
  }

  const byContact: Record<string, ProspectNextAction> = {};
  for (const row of (data ?? []) as DbActionItem[]) {
    if (!row.contact_id) continue;
    byContact[row.contact_id] = dbActionToProspectNextAction(row);
  }
  return byContact;
}

export async function loadProspectNextActionsForContacts(
  supabase: SupabaseClient,
  contacts: Array<{ id: string; coach_id?: string | null }>
): Promise<Record<string, ProspectNextAction>> {
  const byCoach = new Map<string, string[]>();
  for (const contact of contacts) {
    if (!contact.coach_id) continue;
    const list = byCoach.get(contact.coach_id) ?? [];
    list.push(contact.id);
    byCoach.set(contact.coach_id, list);
  }

  const merged: Record<string, ProspectNextAction> = {};
  await Promise.all(
    [...byCoach.entries()].map(async ([coachId, contactIds]) => {
      const chunk = await loadProspectNextActionsByCoach(supabase, coachId, contactIds);
      Object.assign(merged, chunk);
    })
  );
  return merged;
}

async function loadCoachActionItems(coachId: string): Promise<DbActionItem[]> {
  const { data, error } = await supabaseAdmin
    .from("coach_action_items")
    .select("id, text, depth, sort_order, due_at, contact_id, done")
    .eq("coach_id", coachId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as DbActionItem[];
}

function findFollowUpGroupIndex(items: DbActionItem[]): number {
  return items.findIndex(
    (item) => item.depth === 0 && item.text === PROSPECT_FOLLOWUP_GROUP_TEXT
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

async function ensureFollowUpGroup(
  coachId: string,
  items: DbActionItem[]
): Promise<{ items: DbActionItem[]; groupIndex: number }> {
  const existingIndex = findFollowUpGroupIndex(items);
  if (existingIndex >= 0) {
    return { items, groupIndex: existingIndex };
  }

  const line = createOutlineLine(PROSPECT_FOLLOWUP_GROUP_TEXT, 0);
  const sortOrder = items.length ? Math.max(...items.map((item) => item.sort_order)) + 1 : 0;
  const { data, error } = await supabaseAdmin
    .from("coach_action_items")
    .insert({
      id: line.id,
      coach_id: coachId,
      text: PROSPECT_FOLLOWUP_GROUP_TEXT,
      depth: 0,
      sort_order: sortOrder,
      estimate: "",
      recurrence: "none",
      done: false,
      is_locked: false,
    })
    .select("id, text, depth, sort_order, due_at, contact_id, done")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create follow-up group.");
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

export async function upsertProspectNextAction(
  coachId: string,
  contactId: string,
  input: { text: string; dueAt: string | null }
): Promise<ProspectNextAction | null> {
  const trimmedText = input.text.trim();
  let items = await loadCoachActionItems(coachId);
  const existing = items.find((item) => item.contact_id === contactId);

  if (!trimmedText) {
    if (existing) {
      const { error } = await supabaseAdmin
        .from("coach_action_items")
        .delete()
        .eq("id", existing.id)
        .eq("coach_id", coachId)
        .eq("is_locked", false);
      if (error) throw new Error(error.message);
    }
    return null;
  }

  const dueAtIso = input.dueAt ? fromDatetimeLocalValue(`${input.dueAt}T09:00`) : null;

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("coach_action_items")
      .update({
        text: trimmedText,
        due_at: dueAtIso,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("coach_id", coachId)
      .select("id, text, depth, sort_order, due_at, contact_id, done")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to update next action.");
    return dbActionToProspectNextAction(data as DbActionItem);
  }

  const ensured = await ensureFollowUpGroup(coachId, items);
  items = ensured.items;
  const insertAfter = lastChildIndex(items, ensured.groupIndex);
  const insertSortOrder = insertAfter + 1;

  for (const item of items) {
    if (item.sort_order >= insertSortOrder) {
      item.sort_order += 1;
    }
  }

  const line = createOutlineLine(trimmedText, 1);
  const { data, error } = await supabaseAdmin
    .from("coach_action_items")
    .insert({
      id: line.id,
      coach_id: coachId,
      contact_id: contactId,
      text: trimmedText,
      depth: 1,
      sort_order: insertSortOrder,
      due_at: dueAtIso,
      estimate: "",
      recurrence: "none",
      done: false,
      is_locked: false,
    })
    .select("id, text, depth, sort_order, due_at, contact_id, done")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create next action.");

  items.splice(insertAfter + 1, 0, data as DbActionItem);
  await reindexSortOrders(coachId, items);

  return dbActionToProspectNextAction(data as DbActionItem);
}

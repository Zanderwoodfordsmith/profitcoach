import { parseRuleFromDb } from "@/lib/actionPlans/autoCompleteRules";
import type {
  ActionOutlineLine,
  ActionRecurrence,
  DoneSource,
} from "@/lib/actionPlans/types";

type DbCoachActionItem = {
  id: string;
  coach_id: string;
  assignment_id: string | null;
  template_item_id: string | null;
  text: string;
  depth: number;
  sort_order: number;
  estimate: string;
  start_at: string | null;
  due_at: string | null;
  recurrence: string;
  done: boolean;
  done_at: string | null;
  done_source: string | null;
  is_locked: boolean;
  auto_complete_rule: unknown;
};

type DbTemplateItem = {
  id: string;
  template_id: string;
  text: string;
  depth: number;
  sort_order: number;
  auto_complete_rule: unknown;
};

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseRecurrence(value: string): ActionRecurrence {
  if (value === "daily" || value === "weekly" || value === "monthly") return value;
  return "none";
}

function parseDoneSource(value: string | null): DoneSource | null {
  if (value === "manual" || value === "auto") return value;
  return null;
}

export function dbItemToOutlineLine(row: DbCoachActionItem): ActionOutlineLine {
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    depth: row.depth,
    estimate: row.estimate ?? "",
    startAt: toDatetimeLocalValue(row.start_at),
    dueAt: toDatetimeLocalValue(row.due_at),
    recurrence: parseRecurrence(row.recurrence),
    isLocked: row.is_locked,
    assignmentId: row.assignment_id,
    templateItemId: row.template_item_id,
    autoCompleteRule: parseRuleFromDb(row.auto_complete_rule),
    doneSource: parseDoneSource(row.done_source),
    sortOrder: row.sort_order,
  };
}

export function outlineLineToDbInsert(
  line: ActionOutlineLine,
  coachId: string,
  sortOrder: number,
  options?: { assignmentId?: string | null; isLocked?: boolean },
) {
  return {
    id: line.id,
    coach_id: coachId,
    assignment_id: options?.assignmentId ?? line.assignmentId ?? null,
    template_item_id: line.templateItemId ?? null,
    text: line.text,
    depth: line.depth,
    sort_order: sortOrder,
    estimate: line.estimate ?? "",
    start_at: fromDatetimeLocalValue(line.startAt),
    due_at: fromDatetimeLocalValue(line.dueAt),
    recurrence: line.recurrence ?? "none",
    done: line.done,
    done_at: line.done ? new Date().toISOString() : null,
    done_source: line.doneSource ?? (line.done ? "manual" : null),
    is_locked: options?.isLocked ?? line.isLocked ?? false,
    auto_complete_rule: line.autoCompleteRule ? { rule: line.autoCompleteRule } : null,
  };
}

export function templateItemToOutlineLine(row: DbTemplateItem): ActionOutlineLine {
  return {
    id: row.id,
    text: row.text,
    done: false,
    depth: row.depth,
    estimate: "",
    startAt: "",
    dueAt: "",
    recurrence: "none",
    autoCompleteRule: parseRuleFromDb(row.auto_complete_rule),
    sortOrder: row.sort_order,
  };
}

export function outlineLineToTemplateItemInsert(
  templateId: string,
  line: ActionOutlineLine,
  sortOrder: number,
) {
  return {
    id: line.id,
    template_id: templateId,
    text: line.text,
    depth: line.depth,
    sort_order: sortOrder,
    auto_complete_rule: line.autoCompleteRule ? { rule: line.autoCompleteRule } : null,
  };
}

export { fromDatetimeLocalValue, toDatetimeLocalValue };

"use client";

import {
  isClassroomActionGroupTitle,
  isHiddenAssignedActionGroup,
} from "@/lib/actionPlans/classroomActionGroupMeta";
import {
  createOutlineLine,
  formatDueDateLabel,
  formatStartDateTimeLabel,
  isOverdue,
} from "@/lib/actionPlans/actionOutlineUtils";
import type { ActionOutlineLine, ActionRecurrence } from "@/lib/actionPlans/types";
import {
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Hourglass,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type Props = {
  items: ActionOutlineLine[];
  onItemsChange: (items: ActionOutlineLine[]) => void;
  onToggleDone: (index: number, item: ActionOutlineLine) => void;
  loading?: boolean;
  /** `/coach` or `/admin` — prepended to lessonHref paths. */
  appPrefix: string;
};

type ActionSubgroup = {
  headerIndex: number;
  actionIndexes: number[];
};

type ActionGroup = {
  parentIndex: number;
  /** All indexes under this path until the next depth-0 header. */
  childIndexes: number[];
  subgroups: ActionSubgroup[];
  /** Depth-1 leaf actions that are not subgroup headers. */
  flatActionIndexes: number[];
};

const RECURRENCE_CYCLE: ActionRecurrence[] = ["none", "daily", "weekly", "monthly"];

function recurrenceLabel(value: ActionRecurrence) {
  if (value === "daily") return "Repeats daily";
  if (value === "weekly") return "Repeats weekly";
  if (value === "monthly") return "Repeats monthly";
  return "Does not repeat";
}

/** Classroom / assigned actions — not editable like personal todos. */
function isSystemAction(item: ActionOutlineLine) {
  return Boolean(
    item.isLocked ||
      item.academyLessonId ||
      item.academyCourseId ||
      item.assignmentId
  );
}

function isAcademyLeaf(item: ActionOutlineLine) {
  return Boolean(item.academyLessonId || item.academyCourseId);
}

function isSubgroupHeaderAt(
  items: ActionOutlineLine[],
  index: number,
  endExclusive: number
): boolean {
  const item = items[index];
  if (!item || item.depth !== 1) return false;
  if (isAcademyLeaf(item) || item.assignmentId || item.isLocked) return false;
  for (let j = index + 1; j < endExclusive; j += 1) {
    const depth = items[j]?.depth ?? 0;
    if (depth <= 1) break;
    if (depth >= 2) return true;
  }
  return false;
}

function countLeafActions(
  items: ActionOutlineLine[],
  indexes: number[]
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const index of indexes) {
    const item = items[index];
    if (!item || !isAcademyLeaf(item)) continue;
    total += 1;
    if (item.done) done += 1;
  }
  return { done, total };
}

function actionsLabel(done: number, total: number): string {
  return `${done} of ${total} ${total === 1 ? "action" : "actions"}`;
}

export function MyActionsBoard({
  items,
  onItemsChange,
  onToggleDone,
  loading = false,
  appPrefix,
}: Props) {
  /** Accordion: only one path group open at a time. */
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  /** Accordion: only one subgroup open at a time (within the open path). */
  const [openSubgroupId, setOpenSubgroupId] = useState<string | null>(null);
  const [projectNextActions, setProjectNextActions] = useState<Record<string, string>>({});
  const [nextAction, setNextAction] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const result: ActionGroup[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const current = items[i];
      if (!current || current.depth > 0) continue;
      if (isHiddenAssignedActionGroup(current)) {
        let cursor = i + 1;
        while (cursor < items.length && (items[cursor]?.depth ?? 0) > 0) cursor += 1;
        i = cursor - 1;
        continue;
      }
      const childIndexes: number[] = [];
      let cursor = i + 1;
      while (cursor < items.length && (items[cursor]?.depth ?? 0) > 0) {
        childIndexes.push(cursor);
        cursor += 1;
      }
      const endExclusive = cursor;
      const subgroups: ActionSubgroup[] = [];
      const flatActionIndexes: number[] = [];
      for (let c = 0; c < childIndexes.length; ) {
        const index = childIndexes[c];
        if (isSubgroupHeaderAt(items, index, endExclusive)) {
          const actionIndexes: number[] = [];
          c += 1;
          while (c < childIndexes.length && (items[childIndexes[c]]?.depth ?? 0) >= 2) {
            actionIndexes.push(childIndexes[c]);
            c += 1;
          }
          subgroups.push({ headerIndex: index, actionIndexes });
          continue;
        }
        flatActionIndexes.push(index);
        c += 1;
      }
      result.push({ parentIndex: i, childIndexes, subgroups, flatActionIndexes });
      i = cursor - 1;
    }
    return result;
  }, [items]);

  const orphanIndexes = useMemo(() => {
    const covered = new Set<number>();
    for (const group of groups) {
      covered.add(group.parentIndex);
      for (const child of group.childIndexes) covered.add(child);
    }
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item || item.depth !== 0) continue;
      if (!isHiddenAssignedActionGroup(item)) continue;
      covered.add(i);
      let cursor = i + 1;
      while (cursor < items.length && (items[cursor]?.depth ?? 0) > 0) {
        covered.add(cursor);
        cursor += 1;
      }
    }
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => item.depth === 0 && !covered.has(index))
      .map(({ index }) => index);
  }, [groups, items]);

  const updateItem = (index: number, patch: Partial<ActionOutlineLine>) => {
    onItemsChange(
      items.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line
      )
    );
  };

  const onDelete = (index: number) => {
    const item = items[index];
    if (!item || isSystemAction(item)) return;
    const next = items.filter((_, lineIndex) => lineIndex !== index);
    onItemsChange(next.length ? next : [createOutlineLine("", 0)]);
  };

  const cycleRecurrence = (index: number) => {
    const item = items[index];
    if (!item || isSystemAction(item)) return;
    const at = RECURRENCE_CYCLE.indexOf(item.recurrence);
    const next = RECURRENCE_CYCLE[(at + 1) % RECURRENCE_CYCLE.length];
    updateItem(index, { recurrence: next });
  };

  const addProjectAction = (parentIndex: number) => {
    const parent = items[parentIndex];
    if (!parent || parent.isLocked) return;
    const text = (projectNextActions[parent.id] ?? "").trim();
    if (!text) return;
    const line = createOutlineLine(text, Math.max(1, parent.depth + 1));
    const next = [...items];
    let insertAt = parentIndex + 1;
    while (insertAt < next.length && (next[insertAt]?.depth ?? 0) > parent.depth) {
      insertAt += 1;
    }
    next.splice(insertAt, 0, line);
    onItemsChange(next);
    setProjectNextActions((prev) => ({ ...prev, [parent.id]: "" }));
    setFocusId(line.id);
  };

  const addNextAction = () => {
    const text = nextAction.trim();
    if (!text) return;
    const line = createOutlineLine(text, 0);
    onItemsChange([...items, line]);
    setNextAction("");
    setFocusId(line.id);
  };

  const resolveLessonHref = (href: string | null | undefined) => {
    if (!href) return null;
    if (href.startsWith("/coach") || href.startsWith("/admin")) return href;
    return `${appPrefix}${href}`;
  };

  const renderActionRow = (index: number) => {
    const item = items[index];
    if (!item) return null;
    const system = isSystemAction(item);
    const lessonHref = resolveLessonHref(item.lessonHref);

    return (
      <div key={item.id} className="group flex items-center gap-2.5 py-1.5">
        <button
          type="button"
          onClick={() => onToggleDone(index, item)}
          disabled={loading || Boolean(item.isLocked && item.depth === 0)}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
            item.done
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-300 bg-transparent text-transparent hover:border-emerald-500"
          }`}
          aria-label={item.done ? "Mark not done" : "Mark done"}
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {system ? (
            <p
              className={`min-w-0 flex-1 truncate text-[13px] leading-snug ${
                item.done ? "text-slate-400/80 line-through" : "text-slate-600"
              }`}
            >
              {item.text || "Untitled"}
            </p>
          ) : (
            <input
              value={item.text}
              autoFocus={focusId === item.id}
              onFocus={() => setFocusId(item.id)}
              onChange={(e) => updateItem(index, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && item.text.length === 0) {
                  e.preventDefault();
                  onDelete(index);
                }
              }}
              placeholder="Action…"
              className={`min-w-0 flex-1 bg-transparent text-[13px] leading-snug outline-none placeholder:text-slate-400 ${
                item.done ? "text-slate-400/80 line-through" : "text-slate-600"
              }`}
            />
          )}

          {lessonHref ? (
            <Link
              href={lessonHref}
              title={item.lessonTitle ? `Open ${item.lessonTitle}` : "Open lesson"}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-sky-50/80 hover:text-sky-700"
              aria-label={item.lessonTitle ? `Open ${item.lessonTitle}` : "Open lesson"}
            >
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>

        {!system ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <label className="relative flex h-7 min-w-[2.25rem] items-center justify-center rounded-md px-1 text-xs text-slate-500 transition hover:bg-slate-100/80">
              <span className="sr-only">Time estimate</span>
              <input
                value={item.estimate}
                onChange={(e) => updateItem(index, { estimate: e.target.value })}
                className="w-9 bg-transparent text-center text-xs text-slate-600 outline-none"
                aria-label="Time estimate"
              />
              {!item.estimate ? (
                <Hourglass className="pointer-events-none absolute h-3.5 w-3.5 text-slate-500 opacity-0 transition group-hover:opacity-100" />
              ) : null}
            </label>

            <button
              type="button"
              onClick={() => cycleRecurrence(index)}
              title={recurrenceLabel(item.recurrence)}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                item.recurrence !== "none"
                  ? "text-sky-700 hover:bg-sky-50"
                  : "text-slate-500 opacity-0 hover:bg-slate-100 group-hover:opacity-100"
              }`}
              aria-label={recurrenceLabel(item.recurrence)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            <label
              className={`relative flex h-7 items-center justify-center rounded-md px-1.5 transition hover:bg-slate-100/80 ${
                item.dueAt
                  ? !item.done && isOverdue(item.dueAt)
                    ? "text-rose-600"
                    : "text-slate-600"
                  : "text-slate-500 opacity-0 group-hover:opacity-100"
              }`}
              title={item.dueAt ? `Due ${formatDueDateLabel(item.dueAt)}` : "Set due date"}
            >
              <span className="sr-only">Due date</span>
              <input
                type="datetime-local"
                value={item.dueAt}
                onChange={(e) => updateItem(index, { dueAt: e.target.value })}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Due date"
              />
              {item.dueAt ? (
                <span className="text-xs font-medium tabular-nums">
                  {formatDueDateLabel(item.dueAt)}
                </span>
              ) : (
                <Calendar className="h-3.5 w-3.5" />
              )}
            </label>

            {item.startAt ? (
              <span
                className="hidden h-7 items-center px-1 text-xs text-slate-500 sm:flex"
                title={`Starts ${formatStartDateTimeLabel(item.startAt)}`}
              >
                {formatStartDateTimeLabel(item.startAt)}
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => onDelete(index)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderGroup = (
    group: ActionGroup,
    position: number,
    options: { editableTitle: boolean }
  ) => {
    const parent = items[group.parentIndex];
    if (!parent) return null;
    const leafIndexes = [
      ...group.subgroups.flatMap((sub) => sub.actionIndexes),
      ...group.flatActionIndexes.filter((index) => isAcademyLeaf(items[index]!)),
    ];
    // Personal flat children count for non-classroom groups
    const progressIndexes =
      leafIndexes.length > 0
        ? leafIndexes
        : group.flatActionIndexes.length
          ? group.flatActionIndexes
          : group.childIndexes.filter((index) => {
              const item = items[index];
              return item && item.depth > 0 && !isSubgroupHeaderAt(items, index, items.length);
            });
    const { done: doneCount, total } =
      leafIndexes.length > 0
        ? countLeafActions(items, leafIndexes)
        : {
            done: progressIndexes.filter((i) => items[i]?.done).length,
            total: progressIndexes.length,
          };
    const isOpen = openGroupId === parent.id;
    const progress = total ? doneCount / total : 0;

    if (total === 0 && options.editableTitle && group.childIndexes.length === 0) {
      return (
        <div key={parent.id} className={position > 0 ? "mt-8" : undefined}>
          {renderActionRow(group.parentIndex)}
        </div>
      );
    }

    return (
      <section
        key={parent.id}
        className={`rounded-2xl border border-white/55 bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_8px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl backdrop-saturate-150 ${
          position > 0 ? "mt-5" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setOpenGroupId((prev) => (prev === parent.id ? null : parent.id));
            setOpenSubgroupId(null);
          }}
          className="w-full rounded-2xl px-3.5 py-3 text-left transition hover:bg-white/25"
        >
          <div className="flex items-center gap-2">
            {options.editableTitle ? (
              <input
                value={parent.text}
                onChange={(e) => updateItem(group.parentIndex, { text: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 bg-transparent text-base font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="List name"
                aria-label="List name"
              />
            ) : (
              <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-slate-900">
                {parent.text || "Untitled"}
              </h2>
            )}
            <span className="inline-flex shrink-0 items-center gap-1.5">
              {total > 0 ? (
                <span className="text-xs font-medium tabular-nums text-slate-500">
                  {actionsLabel(doneCount, total)}
                </span>
              ) : null}
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
            </span>
          </div>
          {total > 0 ? (
            <div
              className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200/70"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={doneCount}
              aria-label={`${parent.text || "List"} progress`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-[width] duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          ) : null}
        </button>

        {isOpen ? (
          <div className="border-t border-white/40 px-3.5 pb-2.5 pt-1">
            {group.subgroups.map((subgroup) => {
              const subHeader = items[subgroup.headerIndex];
              if (!subHeader) return null;
              const subStats = countLeafActions(items, subgroup.actionIndexes);
              const subOpen = openSubgroupId === subHeader.id;
              const subProgress = subStats.total
                ? subStats.done / subStats.total
                : 0;
              return (
                <div key={subHeader.id} className="mt-1 first:mt-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSubgroupId((prev) =>
                        prev === subHeader.id ? null : subHeader.id
                      )
                    }
                    className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-white/30"
                  >
                    <div
                      className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(#38bdf8 ${Math.round(subProgress * 360)}deg, rgba(226,232,240,0.7) 0deg)`,
                      }}
                      aria-hidden
                    >
                      <div className="absolute inset-[2px] flex items-center justify-center rounded-full bg-white/50 text-[9px] font-semibold tabular-nums text-slate-500 backdrop-blur-sm">
                        {subStats.total ? Math.round(subProgress * 100) : "—"}
                      </div>
                    </div>
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                      {subHeader.text || "Untitled"}
                    </h3>
                    <span className="inline-flex shrink-0 items-center gap-1">
                      {subStats.total > 0 ? (
                        <span className="text-[11px] font-medium tabular-nums text-slate-500">
                          {actionsLabel(subStats.done, subStats.total)}
                        </span>
                      ) : null}
                      {subOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </span>
                  </button>
                  {subOpen ? (
                    <div className="ml-2 border-l border-white/50 pl-3">
                      {subgroup.actionIndexes.map((index) => renderActionRow(index))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {group.flatActionIndexes.map((index) => renderActionRow(index))}

            {!parent.isLocked && options.editableTitle ? (
              <div className="flex items-center gap-3 py-2">
                <span
                  className="flex h-5 w-5 items-center justify-center text-slate-300"
                  aria-hidden
                >
                  +
                </span>
                <input
                  value={projectNextActions[parent.id] ?? ""}
                  onChange={(e) =>
                    setProjectNextActions((prev) => ({
                      ...prev,
                      [parent.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addProjectAction(group.parentIndex);
                    }
                  }}
                  placeholder={`Add to ${parent.text || "this list"}…`}
                  className="min-w-0 flex-1 bg-transparent py-1 text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  };

  const classroomGroups = groups.filter((g) =>
    isClassroomActionGroupTitle(items[g.parentIndex]?.text ?? "")
  );
  const personalGroups = groups.filter(
    (g) => !isClassroomActionGroupTitle(items[g.parentIndex]?.text ?? "")
  );

  return (
    <div className="mx-auto w-full max-w-xl px-2 pb-16 pt-2 sm:px-3">
      {classroomGroups.map((group, i) =>
        renderGroup(group, i, { editableTitle: false })
      )}
      {personalGroups.map((group, i) =>
        renderGroup(group, classroomGroups.length + i, { editableTitle: true })
      )}
      {orphanIndexes.map((index, i) => (
        <div
          key={items[index]?.id ?? index}
          className={
            classroomGroups.length + personalGroups.length + i > 0 ? "mt-6" : undefined
          }
        >
          {renderActionRow(index)}
        </div>
      ))}

      <div className="mt-10 flex items-center gap-3 border-t border-slate-200/80 pt-4">
        <span className="flex h-5 w-5 items-center justify-center text-slate-300" aria-hidden>
          +
        </span>
        <input
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addNextAction();
            }
          }}
          placeholder="Add a personal action…"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>
    </div>
  );
}

"use client";

import {
  AUTO_COMPLETE_RULE_KEYS,
  AUTO_COMPLETE_RULE_LABELS,
  type ActionOutlineLine,
  type ActionRecurrence,
  type AutoCompleteRuleKey,
} from "@/lib/actionPlans/types";
import {
  createOutlineLine,
  formatDueDateLabel,
  formatStartDateTimeLabel,
  formatTimePart,
  isOverdue,
  parseLocalDateTime,
} from "@/lib/actionPlans/actionOutlineUtils";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Hourglass,
  Lock,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

export type ActionOutlineEditorMode = "coach" | "template";

type ActionOutlineEditorProps = {
  items: ActionOutlineLine[];
  onItemsChange: (items: ActionOutlineLine[]) => void;
  mode?: ActionOutlineEditorMode;
  isRowLocked?: (index: number, item: ActionOutlineLine) => boolean;
  onToggleDone?: (index: number, item: ActionOutlineLine) => void;
  showAutoCompleteRule?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  emptyMessage?: string;
};

export function ActionOutlineEditor({
  items,
  onItemsChange,
  mode = "coach",
  isRowLocked,
  onToggleDone,
  showAutoCompleteRule = false,
  fullWidth = false,
  loading = false,
  emptyMessage = "No actions yet. Add your first one above.",
}: ActionOutlineEditorProps) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [nextAction, setNextAction] = useState("");
  const [sortMode, setSortMode] = useState<"manual" | "start" | "due">("manual");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [projectNextActions, setProjectNextActions] = useState<Record<string, string>>({});

  const showEstimateColumn = mode === "coach" || mode === "template";
  const showDateColumns = mode === "coach";

  const rowLocked = (index: number) => {
    const item = items[index];
    if (!item) return false;
    return isRowLocked?.(index, item) ?? Boolean(item.isLocked);
  };

  const handleToggleDone = (index: number) => {
    const item = items[index];
    if (!item) return;
    if (onToggleDone) {
      onToggleDone(index, item);
      return;
    }
    onItemsChange(
      items.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              done: !line.done,
              doneSource: !line.done ? "manual" : null,
            }
          : line,
      ),
    );
  };

  const onDelete = (index: number) => {
    if (rowLocked(index)) return;
    const next = items.filter((_, lineIndex) => lineIndex !== index);
    if (!next.length) {
      const first = createOutlineLine("", 0);
      setFocusId(first.id);
      onItemsChange([first]);
      return;
    }
    setFocusId(next[Math.max(0, index - 1)]?.id ?? null);
    onItemsChange(next);
  };

  const onEdit = (index: number, text: string) => {
    if (rowLocked(index)) return;
    onItemsChange(
      items.map((line, lineIndex) =>
        lineIndex === index ? { ...line, text } : line,
      ),
    );
  };

  const onEditEstimate = (index: number, estimate: string) => {
    if (rowLocked(index)) return;
    onItemsChange(
      items.map((line, lineIndex) =>
        lineIndex === index ? { ...line, estimate } : line,
      ),
    );
  };

  const onEditStartAt = (index: number, startAt: string) => {
    if (rowLocked(index)) return;
    onItemsChange(
      items.map((line, lineIndex) =>
        lineIndex === index ? { ...line, startAt } : line,
      ),
    );
  };

  const onEditDueAt = (index: number, dueAt: string) => {
    if (rowLocked(index)) return;
    onItemsChange(
      items.map((line, lineIndex) =>
        lineIndex === index ? { ...line, dueAt } : line,
      ),
    );
  };

  const onEditRecurrence = (index: number, recurrence: ActionRecurrence) => {
    if (rowLocked(index)) return;
    onItemsChange(
      items.map((line, lineIndex) =>
        lineIndex === index ? { ...line, recurrence } : line,
      ),
    );
  };

  const onEditAutoCompleteRule = (index: number, rule: AutoCompleteRuleKey | "") => {
    onItemsChange(
      items.map((line, lineIndex) =>
        lineIndex === index
          ? { ...line, autoCompleteRule: rule || null }
          : line,
      ),
    );
  };

  const insertLineAfter = (index: number) => {
    if (rowLocked(index)) return;
    const current = items[index];
    if (!current) return;
    const line = createOutlineLine("", current.depth);
    const next = [...items];
    next.splice(index + 1, 0, line);
    setFocusId(line.id);
    onItemsChange(next);
  };

  const onTab = (index: number, outdent: boolean) => {
    if (rowLocked(index)) return;
    const current = items[index];
    if (!current) return;
    const next = [...items];
    if (outdent) {
      next[index] = { ...current, depth: Math.max(0, current.depth - 1) };
      onItemsChange(next);
      return;
    }
    const previous = items[index - 1];
    if (!previous) return;
    const maxDepth = Math.min(6, previous.depth + 1);
    const proposed = current.depth + 1;
    next[index] = { ...current, depth: Math.min(maxDepth, proposed) };
    onItemsChange(next);
  };

  const addNextAction = () => {
    const text = nextAction.trim();
    if (!text) return;
    const line = createOutlineLine(text, 0);
    onItemsChange([...items, line]);
    setNextAction("");
    setFocusId(line.id);
  };

  const sortedIndexes = useMemo(() => {
    const indexes = items.map((_, index) => index);
    if (sortMode === "manual") return indexes;
    return [...indexes].sort((a, b) => {
      const left = sortMode === "start" ? items[a]?.startAt : items[a]?.dueAt;
      const right = sortMode === "start" ? items[b]?.startAt : items[b]?.dueAt;
      const leftValue = parseLocalDateTime(left ?? "")?.getTime() ?? Number.POSITIVE_INFINITY;
      const rightValue = parseLocalDateTime(right ?? "")?.getTime() ?? Number.POSITIVE_INFINITY;
      if (leftValue === rightValue) return a - b;
      return leftValue - rightValue;
    });
  }, [items, sortMode]);

  const manualGroups = useMemo(() => {
    const groups: Array<{ parentIndex: number; childIndexes: number[] }> = [];
    for (let i = 0; i < items.length; i += 1) {
      const current = items[i];
      if (!current) continue;
      if (current.depth > 0) {
        groups.push({ parentIndex: i, childIndexes: [] });
        continue;
      }
      const childIndexes: number[] = [];
      let cursor = i + 1;
      while (cursor < items.length && (items[cursor]?.depth ?? 0) > 0) {
        childIndexes.push(cursor);
        cursor += 1;
      }
      groups.push({ parentIndex: i, childIndexes });
      i = cursor - 1;
    }
    return groups;
  }, [items]);

  const toggleGroupCollapsed = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addProjectAction = (parentIndex: number) => {
    const parent = items[parentIndex];
    if (!parent || rowLocked(parentIndex)) return;
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

  const gridCols = showAutoCompleteRule
    ? showDateColumns
      ? "grid-cols-[minmax(0,1fr)_110px_145px_145px_95px_160px_24px]"
      : showEstimateColumn
        ? "grid-cols-[minmax(0,1fr)_110px_160px_24px]"
        : "grid-cols-[minmax(0,1fr)_160px_24px]"
    : showDateColumns
      ? "grid-cols-[minmax(0,1fr)_110px_145px_145px_95px_24px]"
      : showEstimateColumn
        ? "grid-cols-[minmax(0,1fr)_110px_24px]"
        : "grid-cols-[minmax(0,1fr)_24px]";

  const renderAutoCompleteSelect = (index: number, item: ActionOutlineLine) => {
    if (!showAutoCompleteRule || item.depth === 0) {
      return showAutoCompleteRule ? <span /> : null;
    }
    return (
      <select
        value={item.autoCompleteRule ?? ""}
        onChange={(e) =>
          onEditAutoCompleteRule(index, e.target.value as AutoCompleteRuleKey | "")
        }
        className="w-full appearance-none border-0 bg-transparent px-1 py-1 text-xs text-slate-600 outline-none transition"
        aria-label="Auto-complete rule"
      >
        <option value="">Manual only</option>
        {AUTO_COMPLETE_RULE_KEYS.map((key) => (
          <option key={key} value={key}>
            {AUTO_COMPLETE_RULE_LABELS[key]}
          </option>
        ))}
      </select>
    );
  };

  const renderActionContent = (
    index: number,
    sortedPosition: number,
    options?: { indent?: number; forceOpaqueDelete?: boolean; inAssignedGroup?: boolean },
  ) => {
    const item = items[index];
    if (!item) return null;
    const depth = options?.indent ?? item.depth;
    const locked = rowLocked(index);
    return (
      <div
        className={`group ${gridCols} grid items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 ${
          depth > 0 ? "bg-slate-50/45" : "border border-slate-200 bg-slate-50"
        } ${locked ? "border-slate-200/80" : ""}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => handleToggleDone(index)}
            disabled={loading}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
              item.done
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-300 bg-white text-transparent hover:border-emerald-500"
            }`}
            aria-label={item.done ? "Mark not done" : "Mark done"}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          {locked ? (
            <span className="flex min-w-0 flex-1 items-center gap-2 py-1 text-base text-slate-800">
              <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <span className={`min-w-0 truncate ${item.done ? "text-slate-500 line-through" : ""} ${depth === 0 ? "font-medium" : "font-normal text-slate-700"}`}>
                {item.text || "Untitled"}
              </span>
              {options?.inAssignedGroup && depth === 0 ? (
                <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                  Assigned
                </span>
              ) : null}
              {item.doneSource === "auto" ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Auto
                </span>
              ) : null}
            </span>
          ) : (
            <input
              value={item.text}
              readOnly={locked}
              autoFocus={focusId === item.id}
              onFocus={() => setFocusId(item.id)}
              onChange={(e) => onEdit(index, e.target.value)}
              onKeyDown={(e) => {
                if (locked) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  insertLineAfter(index);
                  return;
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  onTab(index, e.shiftKey);
                  return;
                }
                if (e.key === "Backspace" && item.text.length === 0) {
                  e.preventDefault();
                  onDelete(index);
                }
              }}
              placeholder={sortedPosition === 0 ? "Type your first action..." : "Next action..."}
              className={`min-w-0 flex-1 bg-transparent py-1 text-base outline-none placeholder:text-slate-400 ${
                item.done ? "text-slate-500 line-through" : "text-slate-800"
              } ${depth === 0 ? "font-medium" : "font-normal text-slate-700"}`}
            />
          )}
        </div>
        {showEstimateColumn ? (
          <label className="relative block w-full">
            <input
              value={item.estimate}
              readOnly={locked}
              onChange={(e) => onEditEstimate(index, e.target.value)}
              placeholder={mode === "template" ? "e.g. 30m" : undefined}
              className="peer w-full border-0 bg-transparent px-1 py-1 text-center text-sm text-slate-600 outline-none ring-0 transition focus:text-slate-800"
            />
            {!item.estimate ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 transition peer-focus:opacity-0">
                <Hourglass className="h-4 w-4" />
              </span>
            ) : null}
          </label>
        ) : null}
        {showDateColumns ? (
          <>
            <label className="relative block w-full">
              <input
                type="datetime-local"
                value={item.startAt}
                readOnly={locked}
                onChange={(e) => onEditStartAt(index, e.target.value)}
                className="peer w-full border-0 bg-transparent px-1 py-1 text-sm text-transparent outline-none ring-0 transition [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-0"
                aria-label="Set start date and time"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-500 transition peer-focus:opacity-0">
                {item.startAt ? formatStartDateTimeLabel(item.startAt) : <Calendar className="h-4 w-4" />}
              </span>
            </label>
            <div>
              <label className="relative block w-full">
                <input
                  type="datetime-local"
                  value={item.dueAt}
                  readOnly={locked}
                  onChange={(e) => onEditDueAt(index, e.target.value)}
                  className="peer w-full border-0 bg-transparent px-1 py-1 text-sm text-transparent outline-none ring-0 transition [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-0"
                  aria-label="Set due date and time"
                />
                <span
                  className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm transition peer-focus:opacity-0 ${
                    !item.done && item.dueAt && isOverdue(item.dueAt)
                      ? "text-rose-600"
                      : "text-slate-500"
                  }`}
                >
                  {item.dueAt
                    ? `${formatDueDateLabel(item.dueAt)}${formatTimePart(item.dueAt) ? `, ${formatTimePart(item.dueAt)}` : ""}`
                    : <Calendar className="h-4 w-4" />}
                </span>
              </label>
            </div>
            <select
              value={item.recurrence}
              disabled={locked}
              onChange={(e) =>
                onEditRecurrence(index, e.target.value as ActionRecurrence)
              }
              className="w-full appearance-none border-0 bg-transparent px-1 py-1 text-sm text-slate-700 outline-none transition"
              aria-label="Select recurrence"
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </>
        ) : null}
        {renderAutoCompleteSelect(index, item)}
        {!locked ? (
          <button
            type="button"
            onClick={() => onDelete(index)}
            className={`rounded-md p-1 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 ${
              options?.forceOpaqueDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
            aria-label="Delete line"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <span />
        )}
      </div>
    );
  };

  return (
    <div className={`w-full pb-8 ${fullWidth ? "" : "mx-auto max-w-5xl pr-4"}`}>
      <div>
        {items.length ? (
          <ul className="space-y-2 px-2 pb-2 pt-2">
            {showDateColumns ? (
              <li className="flex items-center justify-end px-2 pb-2">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Sort by
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as "manual" | "start" | "due")}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-sky-400"
                  >
                    <option value="manual">Manual</option>
                    <option value="start">Start</option>
                    <option value="due">Due</option>
                  </select>
                </label>
              </li>
            ) : null}
            <li className={`${gridCols} grid items-center gap-2 px-2 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500`}>
              <span>Action</span>
              {showEstimateColumn ? (
                <span className="flex items-center justify-center">
                  <Hourglass className="h-4 w-4" aria-label="Time estimate" />
                </span>
              ) : null}
              {showDateColumns ? (
                <>
                  <span>Start</span>
                  <span>Due</span>
                  <span>Repeat</span>
                </>
              ) : null}
              {showAutoCompleteRule ? <span>Auto-complete</span> : null}
              <span />
            </li>
            {sortMode === "manual"
              ? manualGroups.map((group, groupPosition) => {
                  const parent = items[group.parentIndex];
                  if (!parent) return null;
                  const hasChildren = group.childIndexes.length > 0;
                  const isAssignedGroup = Boolean(parent.isLocked && parent.assignmentId);
                  if (!hasChildren) {
                    return (
                      <li
                        key={parent.id}
                        className={parent.depth === 0 && groupPosition > 0 ? "mt-2.5" : ""}
                      >
                        {renderActionContent(group.parentIndex, groupPosition, {
                          inAssignedGroup: isAssignedGroup,
                        })}
                      </li>
                    );
                  }
                  const completedChildren = group.childIndexes.filter(
                    (childIndex) => items[childIndex]?.done,
                  ).length;
                  const totalChildren = group.childIndexes.length;
                  const progress = totalChildren ? completedChildren / totalChildren : 0;
                  const isCollapsed = collapsedGroups[parent.id] ?? false;
                  const parentLocked = rowLocked(group.parentIndex);
                  return (
                    <li key={parent.id} className={groupPosition > 0 ? "mt-5" : ""}>
                      <div className="rounded-xl border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => toggleGroupCollapsed(parent.id)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                          aria-label={isCollapsed ? "Expand group" : "Collapse group"}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <div
                              className="relative h-7 w-7 rounded-full bg-slate-200"
                              style={{
                                background: `conic-gradient(#22c55e ${Math.round(progress * 360)}deg, #e2e8f0 0deg)`,
                              }}
                            >
                              <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-600">
                                {`${Math.round(progress * 100)}%`}
                              </div>
                            </div>
                            {parentLocked ? (
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-semibold text-slate-800">
                                  {parent.text || "Untitled project"}
                                </span>
                                {isAssignedGroup ? (
                                  <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                                    Assigned
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <input
                                value={parent.text}
                                onChange={(e) => onEdit(group.parentIndex, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                                placeholder="Project name"
                                aria-label="Project name"
                              />
                            )}
                          </div>
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-500" />
                          )}
                        </button>
                        {!isCollapsed ? (
                          <ul className="space-y-1 border-t border-slate-200 px-2 pb-2 pt-2">
                            {group.childIndexes.map((childIndex, childPosition) => {
                              const child = items[childIndex];
                              if (!child) return null;
                              return (
                                <li key={child.id}>
                                  {renderActionContent(childIndex, childPosition, {
                                    indent: Math.max(1, child.depth),
                                    inAssignedGroup: isAssignedGroup,
                                  })}
                                </li>
                              );
                            })}
                            {!parentLocked ? (
                              <li>
                                <div className={`${gridCols} grid items-center gap-2 rounded-lg px-2 py-1.5`}>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400"
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
                                      placeholder="Add action..."
                                      className="min-w-0 flex-1 bg-transparent py-1 text-base text-slate-800 outline-none placeholder:text-slate-400"
                                    />
                                  </div>
                                  {showEstimateColumn ? <span /> : null}
                                  {showDateColumns ? (
                                    <>
                                      <span />
                                      <span />
                                      <span />
                                    </>
                                  ) : null}
                                  {showAutoCompleteRule ? <span /> : null}
                                  <span />
                                </div>
                              </li>
                            ) : null}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  );
                })
              : sortedIndexes.map((index, sortedPosition) => {
                  const item = items[index];
                  if (!item) return null;
                  return (
                    <li
                      key={item.id}
                      className={item.depth === 0 && sortedPosition > 0 ? "mt-2.5" : ""}
                    >
                      {renderActionContent(index, sortedPosition, {
                        inAssignedGroup: Boolean(item.isLocked && item.assignmentId),
                      })}
                    </li>
                  );
                })}
            <li className="mt-2 pt-2">
              <div className={`${gridCols} grid items-center gap-2 rounded-lg px-2 py-1.5`}>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400"
                    aria-hidden
                  >
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
                    placeholder="Add next action..."
                    className="min-w-0 flex-1 bg-transparent py-1 text-base text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>
                {showEstimateColumn ? <span /> : null}
                {showDateColumns ? (
                  <>
                    <span />
                    <span />
                    <span />
                  </>
                ) : null}
                {showAutoCompleteRule ? <span /> : null}
                <span />
              </div>
            </li>
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

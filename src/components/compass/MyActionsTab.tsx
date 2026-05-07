"use client";

import {
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Hourglass,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type ActionLine = {
  id: string;
  text: string;
  done: boolean;
  depth: number;
  estimate: string;
  startAt: string;
  dueAt: string;
  recurrence: "none" | "daily" | "weekly" | "monthly";
};

type LegacyActionItem = {
  id: string;
  text: string;
  done: boolean;
  children?: LegacyActionItem[];
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseLocalDateTime(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function daysFromToday(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return null;
  const day = startOfDay(parsed);
  if (Number.isNaN(day.getTime())) return null;
  const today = startOfDay(new Date());
  const diffMs = day.getTime() - today.getTime();
  return Math.round(diffMs / 86_400_000);
}

function formatAbsoluteDate(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return value;
  const sameYear = parsed.getFullYear() === new Date().getFullYear();
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}

function formatTimePart(value: string) {
  const timePartRaw = value.split("T")[1]?.slice(0, 5);
  if (!timePartRaw || timePartRaw === "00:00") return "";
  const parsed = parseLocalDateTime(value);
  if (!parsed) return "";
  return parsed.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStartDateTimeLabel(value: string) {
  if (!value) return "";
  const datePart = formatAbsoluteDate(value);
  const timePart = formatTimePart(value);
  return timePart ? `${datePart}, ${timePart}` : datePart;
}

function formatDueDateLabel(value: string) {
  if (!value) return "";
  const diffDays = daysFromToday(value);
  if (diffDays === null) return value;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 14) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) {
    const parsed = parseLocalDateTime(value);
    if (!parsed) return value;
    return parsed.toLocaleDateString(undefined, { weekday: "long" });
  }
  return formatAbsoluteDate(value);
}

function isOverdue(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return false;
  return parsed.getTime() < Date.now();
}

function createLine(text: string, depth: number): ActionLine {
  return {
    id: crypto.randomUUID(),
    text,
    done: false,
    depth,
    estimate: "",
    startAt: "",
    dueAt: "",
    recurrence: "none",
  };
}

function flattenLegacy(items: LegacyActionItem[], depth = 0): ActionLine[] {
  return items.flatMap((item) => {
    const current: ActionLine = {
      id: item.id ?? crypto.randomUUID(),
      text: typeof item.text === "string" ? item.text : "",
      done: Boolean(item.done),
      depth,
      estimate: "",
      startAt: "",
      dueAt: "",
      recurrence: "none",
    };
    const children = Array.isArray(item.children)
      ? flattenLegacy(item.children, depth + 1)
      : [];
    return [current, ...children];
  });
}

export function MyActionsTab() {
  const pathname = usePathname();
  const storageKey = useMemo(
    () => (pathname.startsWith("/admin") ? "compass-my-actions-admin" : "compass-my-actions-coach"),
    [pathname],
  );
  const [items, setItems] = useState<ActionLine[]>([]);
  const [ready, setReady] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [nextAction, setNextAction] = useState("");
  const [sortMode, setSortMode] = useState<"manual" | "start" | "due">("manual");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [projectNextActions, setProjectNextActions] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        const first = createLine("", 0);
        setItems([first]);
        setFocusId(first.id);
        setReady(true);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length) {
        const firstEntry = parsed[0] as Record<string, unknown>;
        if ("depth" in firstEntry) {
          const normalized: ActionLine[] = (parsed as unknown[]).map((entry) => {
            const line = (entry ?? {}) as Record<string, unknown>;
            const recurrence =
              line.recurrence === "daily" ||
              line.recurrence === "weekly" ||
              line.recurrence === "monthly"
                ? line.recurrence
                : "none";
            return {
              id: typeof line.id === "string" ? line.id : crypto.randomUUID(),
              text: typeof line.text === "string" ? line.text : "",
              done: Boolean(line.done),
              depth: Math.max(0, Math.min(6, Number.isFinite(line.depth) ? Number(line.depth) : 0)),
              estimate: typeof line.estimate === "string" ? line.estimate : "",
              startAt: typeof line.startAt === "string" ? line.startAt : "",
              dueAt:
                typeof line.dueAt === "string"
                  ? line.dueAt
                  : typeof line.dueDate === "string"
                    ? line.dueDate
                    : "",
              recurrence,
            };
          });
          setItems(normalized);
          setFocusId(normalized[normalized.length - 1]?.id ?? null);
        } else {
          const migrated = flattenLegacy(parsed as LegacyActionItem[]);
          const lines = migrated.length ? migrated : [createLine("", 0)];
          setItems(lines);
          setFocusId(lines[lines.length - 1]?.id ?? null);
        }
      } else {
        const first = createLine("", 0);
        setItems([first]);
        setFocusId(first.id);
      }
    } catch {
      const first = createLine("", 0);
      setItems([first]);
      setFocusId(first.id);
    } finally {
      setReady(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, ready, storageKey]);

  const onToggleDone = (index: number) => {
    setItems((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, done: !line.done } : line,
      ),
    );
  };

  const onDelete = (index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, lineIndex) => lineIndex !== index);
      if (!next.length) {
        const first = createLine("", 0);
        setFocusId(first.id);
        return [first];
      }
      setFocusId(next[Math.max(0, index - 1)]?.id ?? null);
      return next;
    });
  };

  const onEdit = (index: number, text: string) => {
    setItems((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, text } : line,
      ),
    );
  };

  const onEditEstimate = (index: number, estimate: string) => {
    setItems((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, estimate } : line,
      ),
    );
  };

  const onEditStartAt = (index: number, startAt: string) => {
    setItems((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, startAt } : line,
      ),
    );
  };

  const onEditDueAt = (index: number, dueAt: string) => {
    setItems((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, dueAt } : line,
      ),
    );
  };

  const onEditRecurrence = (index: number, recurrence: ActionLine["recurrence"]) => {
    setItems((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, recurrence } : line,
      ),
    );
  };

  const insertLineAfter = (index: number) => {
    setItems((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const line = createLine("", current.depth);
      const next = [...prev];
      next.splice(index + 1, 0, line);
      setFocusId(line.id);
      return next;
    });
  };

  const onTab = (index: number, outdent: boolean) => {
    setItems((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const next = [...prev];
      if (outdent) {
        next[index] = { ...current, depth: Math.max(0, current.depth - 1) };
        return next;
      }

      const previous = prev[index - 1];
      if (!previous) return prev;
      const maxDepth = Math.min(6, previous.depth + 1);
      const proposed = current.depth + 1;
      next[index] = { ...current, depth: Math.min(maxDepth, proposed) };
      return next;
    });
  };

  const addNextAction = () => {
    const text = nextAction.trim();
    if (!text) return;
    const line = createLine(text, 0);
    setItems((prev) => [...prev, line]);
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
    if (!parent) return;
    const text = (projectNextActions[parent.id] ?? "").trim();
    if (!text) return;
    const line = createLine(text, Math.max(1, parent.depth + 1));
    setItems((prev) => {
      const next = [...prev];
      let insertAt = parentIndex + 1;
      while (insertAt < next.length && (next[insertAt]?.depth ?? 0) > parent.depth) {
        insertAt += 1;
      }
      next.splice(insertAt, 0, line);
      return next;
    });
    setProjectNextActions((prev) => ({ ...prev, [parent.id]: "" }));
    setFocusId(line.id);
  };

  const renderActionContent = (
    index: number,
    sortedPosition: number,
    options?: { indent?: number; forceOpaqueDelete?: boolean },
  ) => {
    const item = items[index];
    if (!item) return null;
    const depth = options?.indent ?? item.depth;
    return (
      <div
        className={`group grid grid-cols-[minmax(0,1fr)_110px_145px_145px_95px_24px] items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 ${
          depth > 0 ? "bg-slate-50/45" : "border border-slate-200 bg-slate-50"
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleDone(index)}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
              item.done
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-300 bg-white text-transparent hover:border-emerald-500"
            }`}
            aria-label={item.done ? "Mark not done" : "Mark done"}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <input
            value={item.text}
            autoFocus={focusId === item.id}
            onFocus={() => setFocusId(item.id)}
            onChange={(e) => onEdit(index, e.target.value)}
            onKeyDown={(e) => {
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
        </div>
        <label className="relative block w-full">
          <input
            value={item.estimate}
            onChange={(e) => onEditEstimate(index, e.target.value)}
            className="peer w-full border-0 bg-transparent px-1 py-1 text-center text-sm text-slate-600 outline-none ring-0 transition focus:text-slate-800"
          />
          {!item.estimate ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 transition peer-focus:opacity-0">
              <Hourglass className="h-4 w-4" />
            </span>
          ) : null}
        </label>
        <label className="relative block w-full">
          <input
            type="datetime-local"
            value={item.startAt}
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
          onChange={(e) =>
            onEditRecurrence(index, e.target.value as ActionLine["recurrence"])
          }
          className="w-full appearance-none border-0 bg-transparent px-1 py-1 text-sm text-slate-700 outline-none transition"
          aria-label="Select recurrence"
        >
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
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
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl pb-8 pr-4">
      <div>
        {items.length ? (
          <ul className="space-y-2 px-2 pb-2 pt-2">
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
            <li className="grid grid-cols-[minmax(0,1fr)_110px_145px_145px_95px_24px] items-center gap-2 px-2 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              <span>Action</span>
              <span className="flex items-center">
                <CalendarPlus className="h-4 w-4" aria-label="Time estimate" />
              </span>
              <span>Start</span>
              <span>Due</span>
              <span>Repeat</span>
              <span />
            </li>
            {sortMode === "manual"
              ? manualGroups.map((group, groupPosition) => {
                  const parent = items[group.parentIndex];
                  if (!parent) return null;
                  const hasChildren = group.childIndexes.length > 0;
                  if (!hasChildren) {
                    return (
                      <li
                        key={parent.id}
                        className={parent.depth === 0 && groupPosition > 0 ? "mt-2.5" : ""}
                      >
                        {renderActionContent(group.parentIndex, groupPosition)}
                      </li>
                    );
                  }
                  const completedChildren = group.childIndexes.filter(
                    (childIndex) => items[childIndex]?.done,
                  ).length;
                  const totalChildren = group.childIndexes.length;
                  const progress = totalChildren ? completedChildren / totalChildren : 0;
                  const isCollapsed = collapsedGroups[parent.id] ?? false;
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
                            <input
                              value={parent.text}
                              onChange={(e) => onEdit(group.parentIndex, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                              placeholder="Project name"
                              aria-label="Project name"
                            />
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
                                  })}
                                </li>
                              );
                            })}
                            <li>
                              <div className="grid grid-cols-[minmax(0,1fr)_110px_145px_145px_95px_24px] items-center gap-2 rounded-lg px-2 py-1.5">
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
                                <span />
                                <span />
                                <span />
                                <span />
                                <span />
                              </div>
                            </li>
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
                      {renderActionContent(index, sortedPosition)}
                    </li>
                  );
                })}
            <li className="mt-2 pt-2">
              <div className="grid grid-cols-[minmax(0,1fr)_110px_145px_145px_95px_24px] items-center gap-2 rounded-lg px-2 py-1.5">
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
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </li>
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500">
            No actions yet. Add your first one above.
          </div>
        )}
      </div>
    </div>
  );
}

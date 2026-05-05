"use client";

import { Check, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type ActionLine = {
  id: string;
  text: string;
  done: boolean;
  depth: number;
  estimate: string;
  dueDate: string;
};

type LegacyActionItem = {
  id: string;
  text: string;
  done: boolean;
  children?: LegacyActionItem[];
};

function createLine(text: string, depth: number): ActionLine {
  return {
    id: crypto.randomUUID(),
    text,
    done: false,
    depth,
    estimate: "",
    dueDate: "",
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
      dueDate: "",
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
          const normalized = (parsed as ActionLine[]).map((line) => ({
            id: line.id ?? crypto.randomUUID(),
            text: typeof line.text === "string" ? line.text : "",
            done: Boolean(line.done),
            depth: Math.max(0, Math.min(6, Number.isFinite(line.depth) ? line.depth : 0)),
            estimate: typeof line.estimate === "string" ? line.estimate : "",
            dueDate: typeof line.dueDate === "string" ? line.dueDate : "",
          }));
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

  const onEditDueDate = (index: number, dueDate: string) => {
    setItems((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, dueDate } : line,
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

  return (
    <div className="mx-auto w-full max-w-3xl pb-8 pr-4">
      <div>
        {items.length ? (
          <ul className="space-y-1 rounded-2xl border border-slate-200/90 bg-white/80 px-2 pb-2 pt-4">
            <li className="grid grid-cols-[minmax(0,1fr)_110px_150px_24px] items-center gap-2 px-2 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              <span>Action</span>
              <span>Time</span>
              <span>Date</span>
              <span />
            </li>
            {items.map((item, index) => (
              <li
                key={item.id}
                className={item.depth === 0 && index > 0 ? "mt-2.5" : ""}
              >
                <div
                  className={`group grid grid-cols-[minmax(0,1fr)_110px_150px_24px] items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 ${
                    item.depth > 0 ? "bg-slate-50/45" : ""
                  }`}
                  style={{ paddingLeft: `${8 + item.depth * 14}px` }}
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
                      placeholder={index === 0 ? "Type your first action..." : "Next action..."}
                      className={`min-w-0 flex-1 bg-transparent py-1 text-base outline-none placeholder:text-slate-400 ${
                        item.done ? "text-slate-500 line-through" : "text-slate-800"
                      } ${item.depth === 0 ? "font-medium" : "font-normal text-slate-700"}`}
                    />
                  </div>
                  <input
                    value={item.estimate}
                    onChange={(e) => onEditEstimate(index, e.target.value)}
                    placeholder="Set time"
                    className="w-full border-0 border-b border-slate-200 bg-transparent px-1 py-1 text-sm text-slate-600 outline-none ring-0 transition placeholder:text-slate-400 focus:border-sky-400 focus:text-slate-800"
                  />
                  <label className="relative block w-full">
                    <input
                      type="date"
                      value={item.dueDate}
                      onChange={(e) => onEditDueDate(index, e.target.value)}
                      className="peer w-full border-0 border-b border-slate-200 bg-transparent px-1 py-1 text-sm text-transparent outline-none ring-0 transition focus:border-sky-400"
                      aria-label="Set date"
                    />
                    <span className="pointer-events-none absolute inset-y-0 left-1 flex items-center text-sm text-slate-600 peer-focus:text-slate-800">
                      {item.dueDate || "Set date"}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => onDelete(index)}
                    className="rounded-md p-1 text-rose-500 opacity-0 transition hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100 focus:opacity-100"
                    aria-label="Delete line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
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

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  clientWorkspacePath,
  newNinetyDayItemId,
  QUARTER_META,
} from "@/lib/clientCoaching/defaults";
import type {
  CoachingPlanDocument,
  NinetyDayItem,
  NinetyDayItemStatus,
  NinetyDayWeek,
  QuarterKey,
} from "@/lib/clientCoaching/types";

type ViewMode = "list" | "board" | "timeline";

type Props = {
  contactId: string;
  plan: CoachingPlanDocument;
  saving: boolean;
  saveError: string | null;
  saveOk: boolean;
  onChange: (next: CoachingPlanDocument) => void;
  onSave: () => void;
};

const STATUS_META: {
  id: NinetyDayItemStatus;
  label: string;
}[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
];

const WEEKS: NinetyDayWeek[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
];

function itemsForQuarter(
  plan: CoachingPlanDocument,
  key: QuarterKey
): NinetyDayItem[] {
  return [...(plan.ninetyDayByQuarter[key] ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

function withQuarterItems(
  plan: CoachingPlanDocument,
  key: QuarterKey,
  items: NinetyDayItem[]
): CoachingPlanDocument {
  return {
    ...plan,
    ninetyDayByQuarter: {
      ...plan.ninetyDayByQuarter,
      [key]: items.map((item, i) => ({ ...item, sortOrder: i })),
    },
  };
}

function ItemCard({
  item,
  onPatch,
  onRemove,
  compact,
}: {
  item: NinetyDayItem;
  onPatch: (patch: Partial<NinetyDayItem>) => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white shadow-sm ${
        compact ? "p-2.5" : "p-3"
      }`}
    >
      <input
        className="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
        value={item.title}
        onChange={(e) => onPatch({ title: e.target.value })}
        placeholder="Action title"
      />
      {!compact ? (
        <textarea
          className="mt-2 w-full resize-y rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-300"
          value={item.notes}
          onChange={(e) => onPatch({ notes: e.target.value })}
          placeholder="Notes"
          rows={2}
        />
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700"
          value={item.status}
          onChange={(e) =>
            onPatch({ status: e.target.value as NinetyDayItemStatus })
          }
        >
          {STATUS_META.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700"
          value={item.week ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onPatch({
              week: v === "" ? null : (Number(v) as NinetyDayWeek),
            });
          }}
        >
          <option value="">No week</option>
          {WEEKS.map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-xs text-slate-400 hover:text-rose-600"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function NinetyDayPlanPanel({
  contactId,
  plan,
  saving,
  saveError,
  saveOk,
  onChange,
  onSave,
}: Props) {
  const [view, setView] = useState<ViewMode>("board");
  const quarterKey = plan.currentQuarterKey;
  const quarterMeta =
    QUARTER_META.find((q) => q.key === quarterKey) ?? QUARTER_META[0];
  const spine =
    plan.quarters.find((q) => q.key === quarterKey) ?? {
      key: quarterKey,
      focus: "",
      outcome: "",
    };
  const items = useMemo(
    () => itemsForQuarter(plan, quarterKey),
    [plan, quarterKey]
  );

  function setItems(next: NinetyDayItem[]) {
    onChange(withQuarterItems(plan, quarterKey, next));
  }

  function patchItem(id: string, patch: Partial<NinetyDayItem>) {
    setItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems(items.filter((item) => item.id !== id));
  }

  function addItem(seed?: Partial<NinetyDayItem>) {
    const next: NinetyDayItem = {
      id: newNinetyDayItemId(),
      title: "",
      notes: "",
      status: seed?.status ?? "todo",
      week: seed?.week ?? null,
      sortOrder: items.length,
    };
    setItems([...items, next]);
  }

  function setCurrentQuarter(key: QuarterKey) {
    onChange({ ...plan, currentQuarterKey: key });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            90-Day plan
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Same quarter as the 3-year spine — list, board, or timeline. Switch
            views anytime; one save.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saveOk ? (
            <span className="text-xs font-medium text-emerald-700">Saved</span>
          ) : null}
          {saveError ? (
            <span className="max-w-xs text-xs text-rose-600">{saveError}</span>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50/80 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
              Current quarter
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                value={quarterKey}
                onChange={(e) =>
                  setCurrentQuarter(e.target.value as QuarterKey)
                }
              >
                {QUARTER_META.map((q) => (
                  <option key={q.key} value={q.key}>
                    {q.label}
                  </option>
                ))}
              </select>
              <Link
                href={clientWorkspacePath(contactId, "plan")}
                className="text-xs font-medium text-sky-700 hover:text-sky-900"
              >
                Edit spine on 3-Year Plan →
              </Link>
            </div>
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
            {(
              [
                ["list", "List"],
                ["board", "Board"],
                ["timeline", "Timeline"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`rounded-md px-3 py-1.5 ${
                  view === id
                    ? "bg-sky-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Focus · {quarterMeta.label}
            </p>
            <p className="mt-1 text-sm text-slate-800">
              {spine.focus.trim() || (
                <span className="italic text-slate-400">
                  No focus set yet — add it on the 3-Year Plan.
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Outcome
            </p>
            <p className="mt-1 text-sm text-slate-800">
              {spine.outcome.trim() || (
                <span className="italic text-slate-400">No outcome set yet.</span>
              )}
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => addItem()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:border-sky-300 hover:bg-sky-50"
        >
          + Add action
        </button>
      </div>

      {view === "list" ? (
        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No actions yet. Add the first one for {quarterMeta.label}.
            </p>
          ) : (
            items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onPatch={(patch) => patchItem(item.id, patch)}
                onRemove={() => removeItem(item.id)}
              />
            ))
          )}
        </div>
      ) : null}

      {view === "board" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {STATUS_META.map((col) => {
            const colItems = items.filter((i) => i.status === col.id);
            return (
              <div
                key={col.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {col.label}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {colItems.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {colItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      compact
                      onPatch={(patch) => patchItem(item.id, patch)}
                      onRemove={() => removeItem(item.id)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => addItem({ status: col.id })}
                    className="rounded-lg border border-dashed border-slate-300 px-2 py-2 text-xs font-medium text-slate-500 hover:border-sky-300 hover:text-sky-700"
                  >
                    + Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {view === "timeline" ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2">
            <div className="w-44 shrink-0 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Backlog
              </h3>
              <div className="mt-2 flex flex-col gap-2">
                {items
                  .filter((i) => i.week == null)
                  .map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      compact
                      onPatch={(patch) => patchItem(item.id, patch)}
                      onRemove={() => removeItem(item.id)}
                    />
                  ))}
                <button
                  type="button"
                  onClick={() => addItem({ week: null })}
                  className="rounded-lg border border-dashed border-slate-300 px-2 py-2 text-xs font-medium text-slate-500 hover:border-sky-300 hover:text-sky-700"
                >
                  + Add
                </button>
              </div>
            </div>
            {WEEKS.map((week) => {
              const weekItems = items.filter((i) => i.week === week);
              return (
                <div
                  key={week}
                  className="w-44 shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Week {week}
                  </h3>
                  <div className="mt-2 flex flex-col gap-2">
                    {weekItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        compact
                        onPatch={(patch) => patchItem(item.id, patch)}
                        onRemove={() => removeItem(item.id)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => addItem({ week })}
                      className="rounded-lg border border-dashed border-slate-300 px-2 py-2 text-xs font-medium text-slate-500 hover:border-sky-300 hover:text-sky-700"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

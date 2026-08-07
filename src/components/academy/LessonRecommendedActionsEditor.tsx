"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import {
  ACADEMY_VERIFY_RULE_KEYS,
  ACADEMY_VERIFY_RULE_LABELS,
  type AcademyActionCompletion,
  type AcademyRecommendedAction,
  type AcademyVerifyRuleKey,
} from "@/lib/academy/lessonActions";

type Props = {
  actions: AcademyRecommendedAction[];
  onChange: (actions: AcademyRecommendedAction[]) => void;
};

function createAction(): AcademyRecommendedAction {
  return {
    id: crypto.randomUUID(),
    text: "",
    completion: "manual",
    verifyRule: null,
  };
}

export function LessonRecommendedActionsEditor({ actions, onChange }: Props) {
  function updateAction(
    id: string,
    patch: Partial<Pick<AcademyRecommendedAction, "text" | "completion" | "verifyRule">>
  ) {
    onChange(
      actions.map((action) => {
        if (action.id !== id) return action;
        const next = { ...action, ...patch };
        if (next.completion === "tracked") {
          next.verifyRule =
            next.verifyRule ?? ACADEMY_VERIFY_RULE_KEYS[0];
        } else {
          next.completion = "manual";
          next.verifyRule = null;
        }
        return next;
      })
    );
  }

  function removeAction(id: string) {
    onChange(actions.filter((action) => action.id !== id));
  }

  function moveAction(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= actions.length) return;
    const next = [...actions];
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  }

  function addAction() {
    onChange([...actions, createAction()]);
  }

  return (
    <div className="space-y-3">
      {actions.length > 0 ? (
        <ol className="space-y-2">
          {actions.map((action, index) => {
            const completion: AcademyActionCompletion =
              action.completion === "tracked" ? "tracked" : "manual";
            return (
              <li
                key={action.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 transition focus-within:border-sky-300 focus-within:bg-white"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={action.text}
                    onChange={(event) =>
                      updateAction(action.id, { text: event.target.value })
                    }
                    placeholder="What should the coach do?"
                    className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  />
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => moveAction(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move action ${index + 1} up`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:invisible"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAction(index, 1)}
                      disabled={index === actions.length - 1}
                      aria-label={`Move action ${index + 1} down`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:invisible"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAction(action.id)}
                      aria-label={`Delete action ${index + 1}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="sr-only">Completion type</span>
                    <select
                      value={completion}
                      onChange={(event) =>
                        updateAction(action.id, {
                          completion: event.target.value as AcademyActionCompletion,
                        })
                      }
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      <option value="manual">Checklist (coach ticks)</option>
                      <option value="tracked">Tracked (auto-completes)</option>
                    </select>
                  </label>
                  {completion === "tracked" ? (
                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="sr-only">Verify when</span>
                      <select
                        value={action.verifyRule ?? ACADEMY_VERIFY_RULE_KEYS[0]}
                        onChange={(event) =>
                          updateAction(action.id, {
                            verifyRule: event.target
                              .value as AcademyVerifyRuleKey,
                          })
                        }
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        {ACADEMY_VERIFY_RULE_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {ACADEMY_VERIFY_RULE_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="py-1 text-sm text-slate-500">
          No actions yet. Add one when this lesson should end with a clear next step.
        </p>
      )}

      <button
        type="button"
        onClick={addAction}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add action
      </button>
    </div>
  );
}

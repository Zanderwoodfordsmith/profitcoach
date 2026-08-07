"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleCheck, Lock } from "lucide-react";

import {
  isTrackedRecommendedAction,
  type AcademyRecommendedAction,
} from "@/lib/academy/lessonActions";
import {
  ACADEMY_TRACKED_ACTIONS_CHANGED,
} from "@/lib/academy/trackedActionsEvents";
import type { AcademyLessonActionItem } from "@/lib/actionPlans/academyLessonActions";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  courseId: string;
  lessonId: string;
  recommendedActions: AcademyRecommendedAction[];
  /**
   * Admin preview: manual actions cannot be ticked into My Actions.
   * Tracked actions still show their real verified state.
   */
  readOnly?: boolean;
};

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  return session?.access_token ?? null;
}

/** Matches lesson sidebar / header completion marks (`LessonProgressControls`). */
function actionMarkClass(done: boolean, interactive: boolean): string {
  const base =
    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition";
  if (done) {
    return `${base} border-emerald-600 bg-emerald-600 text-white shadow-sm`;
  }
  if (interactive) {
    return `${base} border-slate-300/90 bg-transparent text-slate-300 group-hover:border-slate-400 group-hover:text-slate-400`;
  }
  return `${base} border-slate-300/90 bg-transparent text-slate-300`;
}

function ActionMark({
  done,
  tracked,
  interactive = false,
}: {
  done: boolean;
  tracked?: boolean;
  interactive?: boolean;
}) {
  // Incomplete tracked: lock signals “system verifies — you can’t tick this”.
  // Once done, same emerald tick as everything else (done is done).
  if (tracked && !done) {
    return (
      <span className={actionMarkClass(false, false)} aria-hidden>
        <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className={actionMarkClass(done, interactive)} aria-hidden>
      <Check className="h-3 w-3" strokeWidth={done ? 3 : 2.5} />
    </span>
  );
}

export function LessonActionsPanel({
  courseId,
  lessonId,
  recommendedActions,
  readOnly = false,
}: Props) {
  const [items, setItems] = useState<AcademyLessonActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setItems([]);
        return;
      }
      const res = await fetch(
        `/api/coach/academy/lesson-actions/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body = (await res.json()) as {
        items?: AcademyLessonActionItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Failed to load actions");
      setItems(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load actions");
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChanged = () => {
      void load();
    };
    window.addEventListener(ACADEMY_TRACKED_ACTIONS_CHANGED, onChanged);
    return () => {
      window.removeEventListener(ACADEMY_TRACKED_ACTIONS_CHANGED, onChanged);
    };
  }, [load]);

  const byRecommendedId = useMemo(() => {
    const map = new Map<string, AcademyLessonActionItem>();
    for (const item of items) {
      if (item.recommendedActionId) {
        map.set(item.recommendedActionId, item);
      }
    }
    return map;
  }, [items]);

  const doneCount = useMemo(() => {
    let n = 0;
    for (const rec of recommendedActions) {
      if (byRecommendedId.get(rec.id)?.done) n += 1;
    }
    return n;
  }, [recommendedActions, byRecommendedId]);

  const totalCount = recommendedActions.length;
  const progressPct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  async function toggleRecommended(rec: AcademyRecommendedAction) {
    if (readOnly || saving || isTrackedRecommendedAction(rec)) return;
    const existing = byRecommendedId.get(rec.id);
    const nextDone = !(existing?.done ?? false);
    setSaving(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not signed in");

      if (existing) {
        const res = await fetch(
          `/api/coach/academy/lesson-actions/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ actionId: existing.id, done: nextDone }),
          }
        );
        const body = (await res.json()) as {
          item?: AcademyLessonActionItem;
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "Failed to update");
        if (body.item) {
          setItems((prev) =>
            prev.map((row) => (row.id === body.item!.id ? body.item! : row))
          );
        }
      } else {
        const res = await fetch(
          `/api/coach/academy/lesson-actions/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              text: rec.text,
              recommendedActionId: rec.id,
              done: true,
            }),
          }
        );
        const body = (await res.json()) as {
          item?: AcademyLessonActionItem;
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "Failed to add action");
        if (body.item) setItems((prev) => [...prev, body.item!]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-900">Action items</h2>
        {totalCount > 0 ? (
          <p className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
            {doneCount} of {totalCount}
          </p>
        ) : null}
      </div>

      {totalCount > 0 ? (
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200/80"
          role="progressbar"
          aria-label="Action progress"
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-valuenow={doneCount}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/70" />
        </div>
      ) : recommendedActions.length === 0 ? (
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CircleCheck className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">No action needed</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Watch, reflect, and continue when you&apos;re ready.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-1 divide-y divide-slate-200/70">
          {recommendedActions.map((rec) => {
            const linked = byRecommendedId.get(rec.id);
            const done = Boolean(linked?.done);
            const tracked = isTrackedRecommendedAction(rec);

            if (tracked) {
              return (
                <li
                  key={rec.id}
                  className="flex items-start gap-3 py-3.5"
                  title={
                    done
                      ? "Verified automatically"
                      : "Completes automatically when you do this"
                  }
                >
                  <ActionMark done={done} tracked />
                  <span
                    className={`text-sm leading-relaxed ${
                      done ? "text-slate-400 line-through" : "text-slate-800"
                    }`}
                  >
                    {rec.text}
                  </span>
                </li>
              );
            }

            return (
              <li key={rec.id}>
                <button
                  type="button"
                  disabled={readOnly || saving}
                  onClick={() => void toggleRecommended(rec)}
                  aria-pressed={done}
                  aria-label={done ? "Mark action as not done" : "Mark action as done"}
                  className="group flex w-full items-start gap-3 py-3.5 text-left transition disabled:cursor-default disabled:opacity-70"
                >
                  <ActionMark done={done} interactive={!readOnly && !saving} />
                  <span
                    className={`text-sm leading-relaxed ${
                      done ? "text-slate-400 line-through" : "text-slate-800"
                    }`}
                  >
                    {rec.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

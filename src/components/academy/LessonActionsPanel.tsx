"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleCheck } from "lucide-react";

import type { AcademyRecommendedAction } from "@/lib/academy/lessonActions";
import type { AcademyLessonActionItem } from "@/lib/actionPlans/academyLessonActions";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  courseId: string;
  lessonId: string;
  recommendedActions: AcademyRecommendedAction[];
  /** Admin preview: show UI without saving to My Actions. */
  readOnly?: boolean;
};

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  return session?.access_token ?? null;
}

export function LessonActionsPanel({
  courseId,
  lessonId,
  recommendedActions,
  readOnly = false,
}: Props) {
  const [items, setItems] = useState<AcademyLessonActionItem[]>([]);
  const [loading, setLoading] = useState(!readOnly);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (readOnly) {
      setLoading(false);
      return;
    }
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
  }, [courseId, lessonId, readOnly]);

  useEffect(() => {
    void load();
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
    if (readOnly || saving) return;
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
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_35px_-24px_rgba(15,23,42,0.45)]">
      <div className="p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Action items
          </h2>
          {totalCount > 0 ? (
            <p className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
              {doneCount} of {totalCount}
            </p>
          ) : null}
        </div>

        {totalCount > 0 ? (
          <div
            className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100"
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
      </div>

      {error ? (
        <p className="mx-5 mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="border-t border-slate-100 px-5 py-5">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      ) : recommendedActions.length === 0 ? (
        <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
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
        <ul className="divide-y divide-slate-100 border-t border-slate-100 px-5">
          {recommendedActions.map((rec) => {
            const linked = byRecommendedId.get(rec.id);
            const done = Boolean(linked?.done);
            return (
              <li key={rec.id}>
                <button
                  type="button"
                  disabled={readOnly || saving}
                  onClick={() => void toggleRecommended(rec)}
                  className="group flex w-full items-start gap-3 py-3.5 text-left transition disabled:cursor-default disabled:opacity-70"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 bg-white text-transparent group-hover:border-sky-400"
                    }`}
                    aria-hidden
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
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

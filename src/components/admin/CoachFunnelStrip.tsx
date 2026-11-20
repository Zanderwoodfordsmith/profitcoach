"use client";

import { useEffect, useMemo, useState } from "react";
import { gettingLiveAdminHeaders as adminHeaders } from "@/components/admin/CoachGettingLive";
import type { FunnelCoach } from "@/lib/coachFunnel";
import {
  FUNNEL_GROUPS,
  FUNNEL_STAGES,
  PROBLEM_LABEL,
  pct,
  sumCounts,
  weakestStep,
  type FunnelCounts,
} from "@/lib/coachFunnelStages";
import { badgeClass } from "@/components/ui/Badge";
import { cardClass } from "@/components/ui/Card";

/**
 * The coach funnel (job 242) for the coaches on Getting live, or for one
 * coach: how many reached each step, the rate from the step before, and the
 * weakest step named as a market, message, sales, execution or delivery problem.
 */
export function CoachFunnelStrip({
  coaches,
  title,
  bare = false,
}: {
  coaches: FunnelCoach[];
  title: string;
  /** True inside a box that already has its own frame. */
  bare?: boolean;
}) {
  const [byCoach, setByCoach] = useState<Record<string, FunnelCounts> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = coaches.map((c) => `${c.id}:${c.live ? 1 : 0}`).join(",");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await adminHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/coach-funnel", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ coaches }),
      });
      const body = (await res.json().catch(() => null)) as { by_coach?: Record<string, FunnelCounts>; error?: string } | null;
      if (cancelled) return;
      if (!res.ok || !body?.by_coach) setError(body?.error ?? "Could not load the funnel.");
      else setByCoach(body.by_coach);
    })();
    return () => {
      cancelled = true;
    };
    // `key` stands for the coach list; the array itself is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const counts = useMemo(() => (byCoach ? sumCounts(coaches.map((c) => byCoach[c.id]).filter(Boolean)) : null), [byCoach, coaches]);
  const live = coaches.filter((c) => c.live).length;
  const verdict = counts ? weakestStep(counts, live, coaches.length) : null;

  if (error) return <p className="text-sm text-rose-700">{error}</p>;

  return (
    <section className={bare ? "border-y border-slate-200" : cardClass("plain", "overflow-hidden")} aria-label={title}>
      <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-200 ${bare ? "px-0" : "px-4"} py-3`}>
        <h2 className="text-sm font-medium text-slate-900">{title}</h2>
        {verdict ? (
          <p className="flex items-center gap-2 text-sm text-slate-700">
            {verdict.kind ? <span className={badgeClass("amber")}>{PROBLEM_LABEL[verdict.kind]}</span> : null}
            {verdict.text}
          </p>
        ) : (
          <p className="text-sm text-slate-400">Counting…</p>
        )}
      </div>
      {/* Laid out by the strip's own width: one group a row, then two, then all four. */}
      <div className="@container">
      <div className="grid grid-cols-1 gap-px bg-slate-200 @xl:grid-cols-2 @5xl:grid-cols-[minmax(0,0.6fr)_repeat(3,minmax(0,1fr))]">
        {FUNNEL_GROUPS.map((g) => {
          const stages = FUNNEL_STAGES.filter((s) => s.group === g.key);
          return (
            <div key={g.key} className="bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{g.label}</p>
              <div className={`mt-2 grid gap-3 ${stages.length > 1 ? "grid-cols-3" : "grid-cols-1"}`}>
                {stages.map((s) => {
                  const i = FUNNEL_STAGES.findIndex((x) => x.key === s.key);
                  const prev = i > 1 ? FUNNEL_STAGES[i - 1] : null;
                  const c = counts?.[s.key];
                  const prevN = prev && counts ? counts[prev.key].n : null;
                  const weakest = verdict?.kind && verdict.stage === s.key;
                  return (
                    <div key={s.key} className={weakest ? "-m-1.5 rounded-md bg-amber-50 p-1.5" : ""}>
                      <p className="text-xs leading-tight text-slate-600">{s.label}</p>
                      {!c ? (
                        <p className="mt-1 text-xl font-semibold text-slate-300">…</p>
                      ) : c.n === null ? (
                        <p className="mt-1 text-sm text-slate-400" title={c.why}>
                          Not tracked yet
                        </p>
                      ) : s.key === "live" ? (
                        <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                          {coaches.length === 1 ? (live ? "Yes" : "Not yet") : `${live} of ${coaches.length}`}
                        </p>
                      ) : (
                        <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{c.n.toLocaleString("en-GB")}</p>
                      )}
                      {c && c.n !== null && s.key === "contacted" && counts ? (
                        <p className="text-xs tabular-nums text-slate-500">{pct(counts.accepted, c.n)} accepted</p>
                      ) : c && c.n !== null && prevN ? (
                        <p className="text-xs tabular-nums text-slate-500">{pct(c.n, prevN)} of last step</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
}

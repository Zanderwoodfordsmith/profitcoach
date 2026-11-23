"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { gettingLiveAdminHeaders } from "@/components/admin/CoachGettingLive";
import { cardClass } from "@/components/ui/Card";
import { FUNNEL_GROUPS, FUNNEL_STAGES, type FunnelCounts } from "@/lib/coachFunnelStages";
import type { GettingLiveData } from "@/lib/gettingLive";

/**
 * Overview V2 (Zander, 21 Nov): the coach's activation (job 242) as the list of
 * ten steps in their four sections, each ticked once they've reached it.
 */
export function CoachOverviewActivation({ coachId, joinedAt }: { coachId: string; joinedAt: string | null }) {
  const [state, setState] = useState<{ live: boolean; counts: FunnelCounts | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await gettingLiveAdminHeaders();
      if (!headers) return;
      const res = await fetch(`/api/admin/getting-live?coach_id=${encodeURIComponent(coachId)}`, { headers }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as GettingLiveData | null;
      const row = body?.rows?.find((r) => r.coach_id === coachId);
      const live = Boolean(row?.steps.find((s) => s.key === "campaign_live")?.done);
      const funnel = await fetch("/api/admin/coach-funnel", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ coaches: [{ id: coachId, joined_at: joinedAt, live }] }),
      }).catch(() => null);
      const counts = ((await funnel?.json().catch(() => null)) as { by_coach?: Record<string, FunnelCounts> } | null)?.by_coach?.[coachId] ?? null;
      if (!cancelled) setState({ live, counts });
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, joinedAt]);

  const reached = (key: (typeof FUNNEL_STAGES)[number]["key"]): boolean | null => {
    if (!state) return null;
    if (key === "live") return state.live;
    const c = state.counts?.[key];
    return c && c.n !== null ? c.n > 0 : null;
  };

  return (
    <section className={cardClass("plain", "p-5")} aria-label="Activation">
      <h2 className="text-ui font-semibold text-slate-900">Activation</h2>
      {/* One list down, in its four sections. */}
      <div className="mt-1">
        {FUNNEL_GROUPS.map((g) => (
          <div key={g.key} className="mt-4">
            <h3 className="text-caption font-medium text-slate-500">{g.key === "live" ? "Live" : g.label}</h3>
            <ul className="mt-1.5 space-y-2">
              {FUNNEL_STAGES.filter((s) => s.group === g.key).map((s) => {
                const done = reached(s.key);
                return (
                  <li key={s.key} className="flex items-center gap-2.5 text-sm">
                    {done ? (
                      <span className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="size-3" strokeWidth={3} aria-label="Done" />
                      </span>
                    ) : (
                      <span
                        className={`size-[18px] shrink-0 rounded-full border-[1.5px] ${done === null ? "border-dashed border-slate-300" : "border-slate-300"}`}
                        aria-label={done === null ? "Not tracked yet" : "Not yet"}
                        title={done === null ? "Not tracked yet" : undefined}
                      />
                    )}
                    <span className={done ? "text-slate-900" : "text-slate-600"}>{s.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

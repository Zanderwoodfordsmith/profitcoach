"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { CoachHealthRow, HealthLevel } from "@/lib/coachHealth";

const LEVEL_STYLE: Record<HealthLevel, string> = {
  red: "bg-rose-100 text-rose-800",
  amber: "bg-amber-100 text-amber-900",
  green: "bg-emerald-100 text-emerald-800",
};
const LEVEL_LABEL: Record<HealthLevel, string> = { red: "Stuck", amber: "Needs help", green: "On track" };

function pct(v: number | null) {
  return v == null ? "–" : `${Math.round(v * 100)}%`;
}

export default function AdminGetClientsHealthPage() {
  useRequireAdminRole("/coach");
  const [rows, setRows] = useState<CoachHealthRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HealthLevel | "all">("all");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders(null);
      if (!headers || cancelled) return;
      delete headers["x-impersonate-coach-id"];
      const res = await fetch("/api/admin/coach-health", { headers });
      const body = (await res.json().catch(() => null)) as { coaches?: CoachHealthRow[]; error?: string } | null;
      if (cancelled) return;
      if (!res.ok || !body?.coaches) setError(body?.error ?? "Could not load coach health.");
      else setRows(body.coaches);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c = { red: 0, amber: 0, green: 0 };
    for (const r of rows ?? []) c[r.level] += 1;
    return c;
  }, [rows]);
  const stuckReasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.level !== "green") m.set(r.stuck_at, (m.get(r.stuck_at) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const shown = (rows ?? []).filter((r) => filter === "all" || r.level === filter);

  return (
    <div className="flex w-full min-w-0 flex-col">
      <StickyPageHeader
        title="Coaches"
        description="Who is getting clients, who is stuck, and the one thing to fix first. Last 30 days, Get Clients campaigns only."
        tabs={<CoachesHubTabs />}
      />
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {!rows && !error ? <p className="text-sm text-slate-500">Working out each coach&apos;s numbers…</p> : null}
        {rows ? (
          <>
            <div className="flex flex-wrap gap-2">
              {(["all", "red", "amber", "green"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFilter(lvl)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${filter === lvl ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  {lvl === "all" ? `All ${rows.length}` : `${LEVEL_LABEL[lvl]} ${counts[lvl]}`}
                </button>
              ))}
            </div>
            {stuckReasons.length ? (
              <p className="text-sm text-slate-600">
                Most common blockers:{" "}
                {stuckReasons
                  .slice(0, 4)
                  .map(([reason, n]) => `${reason} (${n})`)
                  .join(", ")}
                .
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Coach</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Fix first</th>
                    <th className="px-3 py-2 font-medium">Invites 7d / 30d</th>
                    <th className="px-3 py-2 font-medium">Accepted</th>
                    <th className="px-3 py-2 font-medium">Replies</th>
                    <th className="px-3 py-2 font-medium">Interested</th>
                    <th className="px-3 py-2 font-medium">Calls</th>
                    <th className="px-3 py-2 font-medium">Reply time</th>
                    <th className="px-3 py-2 font-medium">Last in app</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.coach_id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2">
                        <Link href={`/admin/coaches/${r.slug}`} className="font-medium text-slate-900 hover:underline">
                          {r.name}
                        </Link>
                        <div className="text-xs text-slate-500">
                          LinkedIn {r.linkedin === "connected" ? "connected" : r.linkedin === "problem" ? "needs reconnecting" : "not connected"}
                          {r.sales_robot ? " · Sales Robot" : ""}
                          {r.blueprint ? ` · Blueprint ${r.blueprint}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[r.level]}`}>{LEVEL_LABEL[r.level]}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-slate-900">{r.stuck_at}</div>
                        <div className="text-xs text-slate-500">{r.next_step}</div>
                      </td>
                      <td className="px-3 py-2">
                        {r.invites_7d} / {r.invites_30d}
                      </td>
                      <td className="px-3 py-2">{pct(r.accept_rate)}</td>
                      <td className="px-3 py-2">{r.replies_30d}</td>
                      <td className="px-3 py-2">{r.interested_30d}</td>
                      <td className="px-3 py-2">{r.calls_30d}</td>
                      <td className="px-3 py-2">{r.median_reply_hours == null ? "–" : r.median_reply_hours < 1 ? "< 1h" : `${Math.round(r.median_reply_hours)}h`}</td>
                      <td className="px-3 py-2">{r.last_active_days == null ? "–" : r.last_active_days === 0 ? "today" : `${r.last_active_days}d ago`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

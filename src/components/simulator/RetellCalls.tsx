"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { difficultyById } from "@/lib/simulator/difficulty";
import { faceOf } from "@/lib/simulator/faces";
import { RETELL_AGENTS, retellAgent, type RetellCallSummary } from "@/lib/simulator/retell";

import { useSimApi } from "./simApi";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";

type Data = { calls: RetellCallSummary[]; coaches: { id: string; full_name: string | null }[] };

export function formatRetellDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Admin → the practice calls coaches made on the old Retell simulators, scored, with where they're weakest. */
export function RetellCalls() {
  const api = useSimApi();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState("");
  const [namedOnly, setNamedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api<Data>("/api/admin/simulator/retell");
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const shown = useMemo(
    () => (data?.calls ?? []).filter((c) => (!client || c.client_id === client) && (!namedOnly || c.coach_id)),
    [data, client, namedOnly]
  );
  const scored = shown.filter((c) => c.score !== null);
  const average = scored.length ? scored.reduce((s, c) => s + c.score!, 0) / scored.length : null;
  const areas = useMemo(() => {
    const by = new Map<string, number[]>();
    for (const c of shown) for (const a of c.areas) by.set(a.label, [...(by.get(a.label) ?? []), a.score]);
    return Array.from(by, ([label, s]) => ({ label, average: s.reduce((x, y) => x + y, 0) / s.length }))
      .sort((a, b) => a.average - b.average);
  }, [shown]);
  const coachName = (id: string | null) => data?.coaches.find((c) => c.id === id)?.full_name ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl py-8">
      <Link href="/admin/simulator" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Client simulator
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Old Retell calls</h1>
      <p className="mt-1 text-ui text-slate-600">
        Practice calls coaches made on the old Retell simulators, June 2025 to October 2026, scored the same way as the Client simulator.
        Retell didn&rsquo;t record who the coach was, so a call only has a name when the coach said it.
      </p>
      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}
      {!data && !error ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
        </p>
      ) : null}
      {data ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <select value={client} onChange={(e) => setClient(e.target.value)} className={fieldClass("select", "small", "w-auto")} aria-label="Client">
              <option value="">All clients</option>
              {RETELL_AGENTS.map((a) => (
                <option key={a.clientId} value={a.clientId}>
                  {a.oldName} · {a.business}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={namedOnly} onChange={(e) => setNamedOnly(e.target.checked)} />
              Only calls with a coach&rsquo;s name
            </label>
          </div>

          <section className={cardClass("plain", "mt-4 p-5")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Weakest to strongest</h2>
              <p className="text-sm text-slate-500">
                {shown.length} calls · {scored.length} scored
                {average !== null ? (
                  <>
                    {" "}
                    · average <span className="font-semibold tabular-nums text-slate-900">{average.toFixed(1)}</span>/50
                  </>
                ) : null}
              </p>
            </div>
            <ul className="mt-4 space-y-2">
              {areas.map((a) => (
                <li key={a.label} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 text-slate-700">{a.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={`block h-full rounded-full ${a.average >= 3 ? "bg-[#0c5290]" : a.average >= 2.5 ? "bg-[#4a88c2]" : "bg-amber-400"}`}
                      style={{ width: `${(a.average / 5) * 100}%` }}
                    />
                  </span>
                  <span className="w-10 text-right font-semibold tabular-nums text-slate-900">{a.average.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </section>

          <ul className={cardClass("plain", "mt-6 divide-y divide-slate-200 overflow-hidden")}>
            {shown.map((c) => {
              const agent = retellAgent(c.client_id);
              const name = coachName(c.coach_id);
              return (
                <li key={c.call_id}>
                  <Link href={`/admin/simulator/retell/${c.call_id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={faceOf({ face: "", name: agent?.oldName ?? "Sales" })} alt="" className="h-9 w-9 rounded-full object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">
                        {name ?? <span className="text-slate-500">Coach unknown</span>} · {agent ? `${agent.oldName}, ${agent.business.toLowerCase()}` : "Sales objection practice"}
                      </span>
                      <span className="text-slate-500">
                        {formatRetellDate(c.started_at)} · {c.difficulty ? difficultyById(c.difficulty)?.label : "No level"} · {Math.round(c.duration_seconds / 60)} min
                        {!name && c.coach_name_heard ? ` · said "${c.coach_name_heard}"` : ""}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">{c.score ?? "–"}/50</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

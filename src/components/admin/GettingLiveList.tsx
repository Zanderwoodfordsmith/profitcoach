"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { WAITS_LABEL, WAITS_TONE, daysAgo, gettingLiveAdminHeaders as adminHeaders } from "@/components/admin/CoachGettingLive";
import type { GettingLiveData, GettingLiveRow, GettingLiveUpdate } from "@/lib/gettingLive";
import { GETTING_LIVE_STEPS, stepGroupLabel, type GettingLiveStepKey } from "@/lib/gettingLiveSteps";
import { badgeClass } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";

/**
 * Everyone BCA is getting live, as a list or a board, with Add a coach.
 * Shown on Coaches → Getting live and as the Getting live view on the Coaches
 * table. A coach opens on their own page, Getting live tab; `from` tells that
 * page where Back goes.
 */

/** Board columns: the step a coach is on, grouped where steps run together. */
const BOARD_COLUMNS: { label: string; steps: (GettingLiveStepKey | null)[] }[] = [
  { label: "Starting", steps: ["paid", "about_you", "blueprint_call"] },
  { label: "Blueprint", steps: ["blueprint_written"] },
  { label: "LinkedIn", steps: ["linkedin_updated"] },
  { label: "Prospect list", steps: ["leads_found"] },
  { label: "Campaign", steps: ["campaign_set_up"] },
  { label: "Coach agrees", steps: ["signed_off"] },
  { label: "Turn on", steps: ["campaign_live"] },
  { label: "Sending", steps: ["first_reply"] },
  { label: "First call", steps: ["first_call"] },
  { label: "First client", steps: ["first_client", null] },
];

function Board({ rows, onOpen }: { rows: GettingLiveRow[]; onOpen: (row: GettingLiveRow) => void }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-2">
      {BOARD_COLUMNS.map((col) => {
        const inCol = rows.filter((r) => col.steps.includes(r.current));
        return (
          <section key={col.label} className={`md:w-60 md:shrink-0 ${inCol.length ? "" : "hidden md:block"}`}>
            <p className="px-1 text-[11px] text-slate-400">{stepGroupLabel(col.steps[0])}</p>
            <h2 className="mb-2 flex items-baseline justify-between px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              {col.label}
              <span className="tabular-nums">{inCol.length}</span>
            </h2>
            <div className="space-y-2">
              {inCol.length ? (
                inCol.map((r) => (
                  <button
                    key={r.coach_id}
                    type="button"
                    onClick={() => onOpen(r)}
                    className={cardClass("plain", "block w-full p-3 text-left hover:bg-slate-50")}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-medium text-slate-900">{r.name}</span>
                      {r.waits_on ? <span className={badgeClass(WAITS_TONE[r.waits_on])}>{WAITS_LABEL[r.waits_on]}</span> : null}
                    </span>
                    {!r.linkedin_connected ? <span className="mt-0.5 block text-xs text-rose-700">LinkedIn not connected</span> : null}
                    <span className="mt-1 block text-sm text-slate-600">{r.next_action}</span>
                  </button>
                ))
              ) : (
                <p className="px-1 text-sm text-slate-400">Nobody</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function stepNumber(row: GettingLiveRow): number {
  const i = GETTING_LIVE_STEPS.findIndex((s) => s.key === row.current);
  return i < 0 ? GETTING_LIVE_STEPS.length : i + 1;
}

export function GettingLiveList({
  view,
  from,
  framed = true,
  viewSwitcher,
}: {
  view: "list" | "board";
  from: string;
  /** False inside a card that already has its own frame. */
  framed?: boolean;
  /** List and Board icons, shown by Add a coach where the page header doesn't have them. */
  viewSwitcher?: ReactNode;
}) {
  const [data, setData] = useState<GettingLiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [adding, setAdding] = useState("");

  const load = useCallback(async () => {
    const headers = await adminHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/getting-live", { headers });
    const body = (await res.json().catch(() => null)) as (GettingLiveData & { error?: string }) | null;
    if (!res.ok || !body?.rows) setError(body?.error ?? "Could not load Getting live.");
    else {
      setError(null);
      setData(body);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (coachId: string, update: Omit<GettingLiveUpdate, "coach_id">) => {
      const headers = await adminHeaders();
      if (!headers) return false;
      const res = await fetch("/api/admin/getting-live", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ coach_id: coachId, ...update }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not save that.");
        return false;
      }
      await load();
      return true;
    },
    [load]
  );

  const counts = useMemo(() => {
    const c = { coach: 0, bca: 0 };
    for (const r of data?.rows ?? []) if (r.waits_on) c[r.waits_on] += 1;
    return c;
  }, [data]);
  // Each coach's steps and comments live on their own page, in the Getting live tab.
  const openCoach = (r: GettingLiveRow) => {
    if (r.slug) router.push(`/admin/coaches/${encodeURIComponent(r.slug)}?tab=getting-live&from=${encodeURIComponent(from)}`);
  };

  if (error && !data) return <p className="text-sm text-rose-700">{error}</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking where each coach is…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {data.rows.length} coaches. {counts.bca} wait on BCA, {counts.coach} wait on the coach.
        </p>
        <div className="flex items-center gap-2">
          {viewSwitcher}
          <select
            aria-label="Add a coach"
            value={adding}
            disabled={!data.storage}
            onChange={(e) => setAdding(e.target.value)}
            className={fieldClass("select", "small", "w-56")}
          >
            <option value="">Add a coach…</option>
            {data.others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!adding || !data.storage}
            onClick={() => void save(adding, { add: true }).then((ok) => ok && setAdding(""))}
            className={buttonClass("main", "small")}
          >
            Add
          </button>
        </div>
      </div>
      {!data.storage ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Read-only for now. Ticking steps by hand and adding coaches start working once the database table is set up.
        </p>
      ) : null}
      {view === "board" ? <Board rows={data.rows} onOpen={openCoach} /> : null}
      <div className={framed ? cardClass("plain", `overflow-x-auto ${view === "board" ? "hidden" : ""}`) : `overflow-x-auto ${view === "board" ? "hidden" : ""}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">Coach</th>
              <th className="px-3 py-2 font-medium">Step</th>
              <th className="px-3 py-2 font-medium">Waits on</th>
              <th className="px-3 py-2 font-medium">Next</th>
              <th className="px-3 py-2 font-medium" title="Support tickets not yet resolved">Tickets</th>
              <th className="px-3 py-2 font-medium">Last in app</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const n = stepNumber(r);
              const step = GETTING_LIVE_STEPS.find((s) => s.key === r.current);
              return (
                <tr
                  key={r.coach_id}
                  onClick={() => openCoach(r)}
                  className="cursor-pointer border-b border-slate-100 align-top hover:bg-slate-50"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.name}</div>
                    {!r.linkedin_connected ? <div className="text-xs text-rose-700">LinkedIn not connected</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-slate-500">
                        {Math.min(n, GETTING_LIVE_STEPS.length)}/{GETTING_LIVE_STEPS.length}
                      </span>
                      <span className="text-slate-900">
                        {step ? (
                          <>
                            {step.label}
                            <span className="block text-xs text-slate-500">{stepGroupLabel(step.key)}</span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <Check className="h-4 w-4" aria-hidden /> Live
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {r.waits_on ? <span className={badgeClass(WAITS_TONE[r.waits_on])}>{WAITS_LABEL[r.waits_on]}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.next_action}</td>
                  <td className="px-3 py-2 tabular-nums">{r.open_tickets || "–"}</td>
                  <td className="px-3 py-2 text-slate-500">{daysAgo(r.last_active_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

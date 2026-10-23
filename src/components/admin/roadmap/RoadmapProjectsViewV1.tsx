"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import {
  PROJECT_EASE_LEVELS,
  PROJECT_STAGE_META,
  PROJECT_STAGES,
  type ProjectStage,
  type RoadmapProject,
} from "@/lib/roadmap/projectTypes";
import { ROADMAP_IMPACT_LEVELS, type RoadmapJob } from "@/lib/roadmap/types";

/**
 * First version (23 Oct morning), kept to compare. The current view is RoadmapProjectsView.
 *
 * Projects view: one row per project, so Zander steers projects, not jobs.
 * A loose 12-week timeline on top, then each stage (Now, Next, Later, Parked)
 * with the project's goal, its own impact and ease, loose dates and where its
 * jobs stand, and an impact by ease grid of projects at the foot.
 */

type Props = {
  jobs: RoadmapJob[];
  authHeaders: () => Promise<Record<string, string> | null>;
  /** Open the List view filtered to this project. */
  onOpenProject: (name: string) => void;
};

type Row = RoadmapProject & { saved: boolean };

const WEEKS = 12;
const DAY = 86_400_000;
const SCORES = [1, 2, 3, 4, 5] as const;

const STAGE_STYLE: Record<ProjectStage, { bar: string; dot: string; chip: string }> = {
  now: { bar: "bg-[#0c5290]", dot: "bg-[#0c5290]", chip: "bg-[#0c5290] text-white" },
  next: { bar: "bg-sky-400", dot: "bg-sky-400", chip: "bg-sky-100 text-sky-900" },
  later: { bar: "bg-slate-300", dot: "bg-slate-300", chip: "bg-slate-100 text-slate-700" },
  parked: { bar: "bg-amber-300", dot: "bg-amber-300", chip: "bg-amber-50 text-amber-900" },
};

const SHIPPED = new Set(["done", "staged", "live"]);

function mondayOf(d: Date): Date {
  const out = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = (out.getUTCDay() + 6) % 7;
  return new Date(out.getTime() - dow * DAY);
}

function parseDay(s: string | null): number | null {
  return s ? Date.parse(`${s}T00:00:00Z`) : null;
}

function shortDate(t: number): string {
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function summarise(jobs: RoadmapJob[]) {
  const count = (statuses: string[]) => jobs.filter((j) => statuses.includes(j.status)).length;
  return {
    building: count(["in_progress"]),
    review: count(["review"]),
    queued: count(["up_next", "todo"]),
    ideas: count(["evaluate"]),
    shipped: jobs.filter((j) => SHIPPED.has(j.status)).length,
    total: jobs.filter((j) => j.status !== "vetoed").length,
  };
}

export function RoadmapProjectsViewV1({ jobs, authHeaders, onOpenProject }: Props) {
  const [saved, setSaved] = useState<RoadmapProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await authHeaders();
      if (!headers || cancelled) return;
      const res = await fetch("/api/admin/roadmap/projects", { headers }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { projects?: RoadmapProject[]; error?: string } | null;
      if (cancelled) return;
      if (!res?.ok || !body?.projects) setError(body?.error ?? "Could not load projects.");
      else setSaved(body.projects);
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  // Every project named on a job shows, saved or not; unsaved ones wait in Next until given a stage.
  const rows: Row[] = useMemo(() => {
    if (!saved) return [];
    const byName = new Map(saved.map((p) => [p.name, p]));
    const names = new Set([...saved.map((p) => p.name), ...jobs.map((j) => j.project).filter((p): p is string => Boolean(p))]);
    return [...names].map((name) => {
      const p = byName.get(name);
      return p
        ? { ...p, saved: true }
        : { name, stage: "next", goal: null, impact: null, ease: null, start_on: null, target_on: null, sort_order: 999, updated_at: "", saved: false };
    });
  }, [saved, jobs]);

  const jobsBy = useMemo(() => {
    const map = new Map<string, RoadmapJob[]>();
    for (const j of jobs) if (j.project) map.set(j.project, [...(map.get(j.project) ?? []), j]);
    return map;
  }, [jobs]);

  const save = async (name: string, patch: Partial<RoadmapProject>) => {
    // Show the change at once; the save follows.
    setSaved((prev) => {
      const list = prev ?? [];
      return list.some((p) => p.name === name)
        ? list.map((p) => (p.name === name ? { ...p, ...patch } : p))
        : [...list, { name, stage: "next", goal: null, impact: null, ease: null, start_on: null, target_on: null, sort_order: 999, updated_at: "", ...patch }];
    });
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/roadmap/projects", { method: "PATCH", headers, body: JSON.stringify({ name, ...patch }) }).catch(() => null);
    if (!res?.ok) setError("That change didn't save. Refresh and try again.");
  };

  if (error && !saved) return <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>;
  if (!saved) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading projects…
      </p>
    );
  }

  const ordered = (stage: ProjectStage) =>
    rows.filter((r) => r.stage === stage).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return (
    <div className="mt-3 space-y-5 pb-10">
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      <Timeline rows={[...ordered("now"), ...ordered("next"), ...ordered("later")]} />

      {PROJECT_STAGES.map((stage) => {
        const list = ordered(stage);
        return (
          <section key={stage} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-slate-100 px-4 py-2.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className={`h-2.5 w-2.5 rounded-full ${STAGE_STYLE[stage].dot}`} aria-hidden />
                {PROJECT_STAGE_META[stage].label}
                <span className="font-normal tabular-nums text-slate-400">{list.length}</span>
              </h2>
              <p className="text-xs text-slate-500">{PROJECT_STAGE_META[stage].hint}</p>
            </header>
            {list.length ? (
              <ul className="divide-y divide-slate-100">
                {list.map((row) => (
                  <ProjectRow key={row.name} row={row} jobs={jobsBy.get(row.name) ?? []} onSave={save} onOpen={() => onOpenProject(row.name)} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-slate-400">Nothing here.</p>
            )}
          </section>
        );
      })}

      <ProjectGrid rows={rows.filter((r) => r.stage !== "parked")} />
    </div>
  );
}

function ProjectRow({
  row,
  jobs,
  onSave,
  onOpen,
}: {
  row: Row;
  jobs: RoadmapJob[];
  onSave: (name: string, patch: Partial<RoadmapProject>) => void;
  onOpen: () => void;
}) {
  const [goal, setGoal] = useState(row.goal ?? "");
  const s = summarise(jobs);
  const select = "h-8 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none";
  const dateInput = "h-8 w-[8.5rem] rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none";
  const parts = [
    s.building ? `${s.building} building` : null,
    s.queued ? `${s.queued} to do` : null,
    s.ideas ? `${s.ideas} ${s.ideas === 1 ? "idea" : "ideas"}` : null,
    s.shipped ? `${s.shipped} shipped` : null,
  ].filter(Boolean);

  return (
    <li className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            title="Open this project's jobs in the List view"
            className="group inline-flex items-center gap-1 text-[0.9375rem] font-semibold text-slate-900 hover:text-[#0c5290]"
          >
            {row.name}
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#0c5290]" aria-hidden />
          </button>
          {s.review ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">
              {s.review} waiting on you
            </span>
          ) : null}
          {!row.saved ? <span className="text-[11px] text-slate-400">not sorted yet</span> : null}
        </div>
        <input
          id={`goal-${row.name}`}
          aria-label={`Goal for ${row.name}`}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onBlur={() => {
            if (goal.trim() !== (row.goal ?? "")) onSave(row.name, { goal: goal.trim() || null });
          }}
          placeholder="One line: what done looks like for this project"
          className="mt-1 block w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 -ml-1 text-sm text-slate-600 placeholder:text-slate-300 hover:border-slate-200 focus:border-sky-500 focus:bg-white focus:outline-none"
        />
        <p className="mt-1 text-xs tabular-nums text-slate-500">
          {parts.length ? parts.join(" · ") : "No jobs yet"}
          {s.total ? <span className="text-slate-400"> · {s.total} in all</span> : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
          Stage
          <select
            id={`stage-${row.name}`}
            className={select}
            value={row.stage}
            onChange={(e) => onSave(row.name, { stage: e.target.value as ProjectStage })}
          >
            {PROJECT_STAGES.map((st) => (
              <option key={st} value={st}>
                {PROJECT_STAGE_META[st].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500" title="Impact: coach results, cash, member happiness or less work for Zander">
          Impact
          <select
            id={`impact-${row.name}`}
            className={select}
            value={row.impact ?? ""}
            onChange={(e) => onSave(row.name, { impact: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">–</option>
            {SCORES.map((n) => (
              <option key={n} value={n}>
                {n} {ROADMAP_IMPACT_LEVELS[n]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500" title="Ease: how soon the whole project could be live">
          Ease
          <select
            id={`ease-${row.name}`}
            className={select}
            value={row.ease ?? ""}
            onChange={(e) => onSave(row.name, { ease: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">–</option>
            {SCORES.map((n) => (
              <option key={n} value={n}>
                {n} {PROJECT_EASE_LEVELS[n]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
          From
          <input
            id={`start-${row.name}`}
            type="date"
            className={dateInput}
            value={row.start_on ?? ""}
            onChange={(e) => onSave(row.name, { start_on: e.target.value || null })}
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
          To
          <input
            id={`target-${row.name}`}
            type="date"
            className={dateInput}
            value={row.target_on ?? ""}
            onChange={(e) => onSave(row.name, { target_on: e.target.value || null })}
          />
        </label>
      </div>
    </li>
  );
}

/** The next 12 weeks, one bar per project with loose dates, and a line for today. */
function Timeline({ rows }: { rows: Row[] }) {
  // Read the clock once, not on every render.
  const [today] = useState(() => Date.now());
  const start = mondayOf(new Date(today)).getTime();
  const end = start + WEEKS * 7 * DAY;
  const dated = rows.filter((r) => r.start_on || r.target_on);
  const undated = rows.filter((r) => !r.start_on && !r.target_on);
  const pct = (t: number) => `${Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100))}%`;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">The next 12 weeks</h2>
        <p className="text-xs text-slate-500">Loose dates. Change them on each project below.</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[44rem]">
          <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3">
            <span />
            <div className="grid text-[11px] text-slate-400" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
              {Array.from({ length: WEEKS }, (_, i) => (
                <span key={i} className="border-l border-slate-100 pl-1 tabular-nums">
                  {shortDate(start + i * 7 * DAY)}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-1 space-y-1.5">
            {dated.map((r) => {
              const from = parseDay(r.start_on) ?? parseDay(r.target_on)!;
              const to = (parseDay(r.target_on) ?? from) + DAY;
              const off = to < start || from > end;
              return (
                <div key={r.name} className="grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-3">
                  <span className="truncate text-xs font-medium text-slate-700" title={r.name}>
                    {r.name}
                  </span>
                  <div className="relative h-6 rounded bg-slate-50">
                    <span className="absolute inset-y-0 w-px bg-rose-400" style={{ left: pct(today) }} aria-hidden />
                    {off ? (
                      <span className="absolute inset-y-0 left-1 flex items-center text-[11px] text-slate-400">Outside these 12 weeks</span>
                    ) : (
                      <span
                        className={`absolute inset-y-1 rounded ${STAGE_STYLE[r.stage].bar}`}
                        style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)})` }}
                        title={`${r.name}: ${r.start_on ?? "?"} to ${r.target_on ?? "?"}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {undated.length ? (
        <p className="mt-3 text-xs text-slate-500">
          No dates yet: <span className="text-slate-600">{undated.map((r) => r.name).join(", ")}</span>
        </p>
      ) : null}
    </section>
  );
}

/** Where each project sits on impact and ease: top right is worth most for least. */
function ProjectGrid({ rows }: { rows: Row[] }) {
  const scored = rows.filter((r) => r.impact && r.ease);
  const unscored = rows.filter((r) => !(r.impact && r.ease));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Projects by impact and ease</h2>
        <p className="text-xs text-slate-500">Top right: worth most for the least effort. Parked projects left out.</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="grid min-w-[36rem] grid-cols-[1.25rem_repeat(5,minmax(0,1fr))] gap-1">
          {[5, 4, 3, 2, 1].map((impact) => (
            <div key={impact} className="contents">
              <span className="flex items-center justify-center text-xs font-bold tabular-nums text-slate-500" title={`Impact ${impact}`}>
                {impact}
              </span>
              {SCORES.map((ease) => (
                <div key={ease} className={`flex min-h-12 flex-wrap content-start gap-1 rounded-md p-1.5 ${impact >= 4 && ease >= 3 ? "bg-emerald-50" : "bg-slate-50"}`}>
                  {scored
                    .filter((r) => r.impact === impact && r.ease === ease)
                    .map((r) => (
                      <span key={r.name} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLE[r.stage].chip}`}>
                        {r.name}
                      </span>
                    ))}
                </div>
              ))}
            </div>
          ))}
          <span />
          {SCORES.map((ease) => (
            <span key={ease} className="text-center text-[11px] text-slate-500">
              Ease {ease}
            </span>
          ))}
        </div>
      </div>
      {unscored.length ? <p className="mt-3 text-xs text-slate-500">Not scored: {unscored.map((r) => r.name).join(", ")}</p> : null}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarRange, Loader2 } from "lucide-react";
import {
  PROJECT_EASE_LEVELS,
  PROJECT_STAGE_META,
  PROJECT_STAGES,
  type ProjectStage,
  type RoadmapProject,
} from "@/lib/roadmap/projectTypes";
import { ROADMAP_IMPACT_LEVELS, type RoadmapJob } from "@/lib/roadmap/types";
import { Caret, MetaDropdown, ScoreDropdown, useDismiss } from "./roadmapUi";
import { RoadmapProjectsViewV1 } from "./RoadmapProjectsViewV1";

/**
 * Projects view: one row per project, in the List view's look (sticky column
 * headings, big group headings, coloured score pills). A loose 12-week
 * timeline on top; Now, Next, Later and Parked below; where each project sits
 * on impact and ease at the foot. The goal opens under a row, not in it.
 */

type Props = {
  jobs: RoadmapJob[];
  authHeaders: () => Promise<Record<string, string> | null>;
  onOpenProject: (name: string) => void;
  /** Height of the sticky page header, so the column headings stick under it. */
  stickyTop: number;
};

type Row = RoadmapProject & { saved: boolean };

const DAY = 86_400_000;
const WEEKS = 12;
const LAYOUT_KEY = "roadmap-projects-layout";

/** Now is the brand navy, Next the sky, Later quiet, Parked amber. */
const STAGE_TONE: Record<ProjectStage, { dot: string; bar: string; pill: string; chip: string }> = {
  now: { dot: "bg-[#0c5290]", bar: "bg-[#0c5290]", pill: "bg-[#0c5290] text-white", chip: "bg-[#0c5290] text-white" },
  next: { dot: "bg-sky-500", bar: "bg-sky-500", pill: "bg-sky-100 text-sky-800", chip: "bg-sky-100 text-sky-900" },
  later: { dot: "bg-slate-400", bar: "bg-slate-300", pill: "bg-slate-200/80 text-slate-700", chip: "bg-slate-100 text-slate-700" },
  parked: { dot: "bg-amber-400", bar: "bg-amber-300", pill: "bg-amber-100 text-amber-800", chip: "bg-amber-50 text-amber-900" },
};

const COLUMNS = [
  { key: "project", label: "Project", width: 300 },
  { key: "jobs", label: "Where it stands", width: 290 },
  { key: "impact", label: "Impact", width: 150 },
  { key: "ease", label: "Ease", width: 180 },
  { key: "dates", label: "When", width: 200 },
  { key: "stage", label: "Stage", width: 110 },
] as const;
const TABLE_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);

function parseDay(s: string | null): number | null {
  return s ? Date.parse(`${s}T00:00:00Z`) : null;
}

function short(t: number): string {
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function mondayOf(t: number): number {
  const d = new Date(t);
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return utc - ((new Date(utc).getUTCDay() + 6) % 7) * DAY;
}

function counts(jobs: RoadmapJob[]) {
  const n = (statuses: string[]) => jobs.filter((j) => statuses.includes(j.status)).length;
  return { review: n(["review"]), building: n(["in_progress"]), todo: n(["up_next", "todo"]), shipped: n(["done", "staged", "live"]) };
}

export function RoadmapProjectsView(props: Props) {
  const [layout, setLayout] = useState<"new" | "v1">(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(LAYOUT_KEY) === "v1" ? "v1" : "new";
    } catch {
      return "new";
    }
  });
  const pick = (next: "new" | "v1") => {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // Remembering the layout is only a convenience.
    }
  };
  const toggle = (
    <p className="mt-6 text-xs text-slate-400">
      {layout === "new" ? "Comparing? " : "This is the first version. "}
      <button type="button" onClick={() => pick(layout === "new" ? "v1" : "new")} className="font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800">
        {layout === "new" ? "See the first version" : "Back to the new layout"}
      </button>
    </p>
  );
  if (layout === "v1") {
    return (
      <>
        <RoadmapProjectsViewV1 jobs={props.jobs} authHeaders={props.authHeaders} onOpenProject={props.onOpenProject} />
        {toggle}
      </>
    );
  }
  return (
    <>
      <ProjectsTable {...props} />
      {toggle}
    </>
  );
}

function ProjectsTable({ jobs, authHeaders, onOpenProject, stickyTop }: Props) {
  const [saved, setSaved] = useState<RoadmapProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<ProjectStage>>(() => new Set());
  const [openRow, setOpenRow] = useState<string | null>(null);

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

  const rows: Row[] = useMemo(() => {
    if (!saved) return [];
    const byName = new Map(saved.map((p) => [p.name, p]));
    const names = new Set([...saved.map((p) => p.name), ...jobs.map((j) => j.project).filter((p): p is string => Boolean(p))]);
    return [...names].map((name) => {
      const p = byName.get(name);
      return p
        ? { ...p, saved: true }
        : { name, stage: "next" as const, goal: null, impact: null, ease: null, start_on: null, target_on: null, sort_order: 999, updated_at: "", saved: false };
    });
  }, [saved, jobs]);

  const jobsBy = useMemo(() => {
    const map = new Map<string, RoadmapJob[]>();
    for (const j of jobs) if (j.project) map.set(j.project, [...(map.get(j.project) ?? []), j]);
    return map;
  }, [jobs]);

  const save = async (name: string, patch: Partial<RoadmapProject>) => {
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

  const inStage = (stage: ProjectStage) =>
    rows.filter((r) => r.stage === stage).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return (
    <div className="mt-4 pb-6">
      {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}

      <Timeline rows={[...inStage("now"), ...inStage("next"), ...inStage("later")]} />

      {/* Sideways scroll only below lg: an overflow box would stop the headings sticking. */}
      <div className="mt-6 overflow-x-auto lg:overflow-visible">
        <table className="table-fixed text-left text-sm" style={{ width: TABLE_WIDTH }}>
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
          </colgroup>
          <thead className="text-xs font-medium text-slate-500">
            <tr>
              {COLUMNS.map((c, i) => (
                <th
                  key={c.key}
                  style={{ top: stickyTop }}
                  className={`sticky z-10 bg-[var(--app-canvas-base)] py-2.5 shadow-[inset_0_-1px_0_rgb(226_232_240)] ${i === 0 ? "pl-[1.625rem] pr-4" : "px-3"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          {PROJECT_STAGES.map((stage, si) => {
            const list = inStage(stage);
            const open = !collapsed.has(stage);
            return (
              <tbody key={stage}>
                <tr>
                  <td colSpan={COLUMNS.length} className={`pb-0.5 ${si === 0 ? "pt-2" : "pt-5"}`}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (next.has(stage)) next.delete(stage);
                          else next.add(stage);
                          return next;
                        })
                      }
                      title={PROJECT_STAGE_META[stage].hint}
                      className="inline-flex items-center gap-2.5 py-1 text-left"
                    >
                      <Caret open={open} />
                      <span className={`h-2 w-2 rounded-full ${STAGE_TONE[stage].dot}`} />
                      <span className="text-lg font-medium tracking-[-0.01em] text-slate-950">{PROJECT_STAGE_META[stage].label}</span>
                      <span className="text-sm tabular-nums text-slate-400">{list.length}</span>
                      <span className="hidden text-xs text-slate-400 sm:inline">{PROJECT_STAGE_META[stage].hint}</span>
                    </button>
                  </td>
                </tr>
                {open
                  ? list.map((row) => (
                      <ProjectRows
                        key={row.name}
                        row={row}
                        jobs={jobsBy.get(row.name) ?? []}
                        expanded={openRow === row.name}
                        onToggle={() => setOpenRow((cur) => (cur === row.name ? null : row.name))}
                        onSave={save}
                        onOpenJobs={() => onOpenProject(row.name)}
                      />
                    ))
                  : null}
                {open && !list.length ? (
                  <tr className="border-t border-slate-200">
                    <td colSpan={COLUMNS.length} className="py-3 pl-[1.625rem] text-sm text-slate-400">
                      Nothing here.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            );
          })}
        </table>
      </div>

      <ProjectGrid rows={rows.filter((r) => r.stage !== "parked")} />
    </div>
  );
}

function ProjectRows({
  row,
  jobs,
  expanded,
  onToggle,
  onSave,
  onOpenJobs,
}: {
  row: Row;
  jobs: RoadmapJob[];
  expanded: boolean;
  onToggle: () => void;
  onSave: (name: string, patch: Partial<RoadmapProject>) => void;
  onOpenJobs: () => void;
}) {
  const c = counts(jobs);
  const [goal, setGoal] = useState(row.goal ?? "");
  return (
    <>
      <tr className="border-t border-slate-200 align-middle transition hover:bg-white/70">
        <td className="py-2.5 pl-1 pr-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? `Hide ${row.name}'s goal` : `Show ${row.name}'s goal`}
              onClick={onToggle}
              className="rounded p-1 hover:bg-slate-200/60"
            >
              <Caret open={expanded} />
            </button>
            <button
              type="button"
              onClick={onOpenJobs}
              title={row.goal ? `${row.goal}\n\nOpen this project's jobs` : "Open this project's jobs"}
              className="truncate text-[0.9375rem] font-medium text-slate-900 transition hover:text-[#0c5290]"
            >
              {row.name}
            </button>
            {!row.saved ? <span className="shrink-0 text-[11px] text-slate-400">new</span> : null}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <JobCounts c={c} />
        </td>
        <td className="px-2 py-2">
          <ScoreDropdown value={row.impact} names={ROADMAP_IMPACT_LEVELS} onChange={(v) => onSave(row.name, { impact: v })} />
        </td>
        <td className="px-2 py-2">
          <ScoreDropdown value={row.ease} names={PROJECT_EASE_LEVELS} onChange={(v) => onSave(row.name, { ease: v })} />
        </td>
        <td className="px-2 py-2">
          <DatesPicker row={row} onSave={onSave} />
        </td>
        <td className="px-2 py-2">
          <MetaDropdown
            bare
            display={<StagePill stage={row.stage} />}
            options={PROJECT_STAGES.map((st) => ({
              key: st,
              selected: row.stage === st,
              onSelect: () => onSave(row.name, { stage: st }),
              node: <StagePill stage={st} />,
            }))}
          />
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-white/60">
          <td colSpan={COLUMNS.length} className="pb-4 pl-[1.625rem] pr-4 pt-1">
            <label htmlFor={`goal-${row.name}`} className="text-xs font-medium text-slate-500">
              Goal: what done looks like
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <input
                id={`goal-${row.name}`}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onBlur={() => {
                  if (goal.trim() !== (row.goal ?? "")) onSave(row.name, { goal: goal.trim() || null });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                placeholder="One line, e.g. BCA writes the whole practice from About You"
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100"
              />
              <button type="button" onClick={onOpenJobs} className="inline-flex items-center gap-1 text-sm font-medium text-[#0c5290] hover:underline">
                Open its {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** Where a project's jobs stand, most urgent first: yours to review, building, to do, shipped. */
function JobCounts({ c }: { c: ReturnType<typeof counts> }) {
  const parts = [
    c.review ? { n: c.review, label: "to review", cls: "bg-amber-100 text-amber-900" } : null,
    c.building ? { n: c.building, label: "building", cls: "bg-sky-100 text-sky-900" } : null,
    c.todo ? { n: c.todo, label: "to do", cls: "bg-slate-200/70 text-slate-700" } : null,
    c.shipped ? { n: c.shipped, label: "live", cls: "bg-emerald-50 text-emerald-800" } : null,
  ].filter((p): p is { n: number; label: string; cls: string } => Boolean(p));
  if (!parts.length) return <span className="text-xs text-slate-400">No jobs yet</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p) => (
        <span key={p.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${p.cls}`}>
          <span className="font-semibold tabular-nums">{p.n}</span>
          {p.label}
        </span>
      ))}
    </div>
  );
}

function StagePill({ stage }: { stage: ProjectStage }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${STAGE_TONE[stage].pill}`}>
      {PROJECT_STAGE_META[stage].label}
    </span>
  );
}

/** "19 Oct → 6 Nov · 3 wks", or Add dates; opens two date boxes. */
function DatesPicker({ row, onSave }: { row: Row; onSave: (name: string, patch: Partial<RoadmapProject>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const from = parseDay(row.start_on);
  const to = parseDay(row.target_on);
  const weeks = from && to ? Math.max(1, Math.round((to - from) / (7 * DAY))) : null;
  const box = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none";
  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm transition ${
          from || to ? "text-slate-800 hover:bg-slate-200/60" : "border border-dashed border-slate-300 text-slate-500 hover:border-slate-400"
        }`}
      >
        {from || to ? (
          <>
            <span className="font-medium tabular-nums">
              {from ? short(from) : "?"} → {to ? short(to) : "?"}
            </span>
            {weeks ? <span className="text-xs tabular-nums text-slate-400">{weeks} wk{weeks === 1 ? "" : "s"}</span> : null}
          </>
        ) : (
          <>
            <CalendarRange className="h-3.5 w-3.5" aria-hidden />
            Add dates
          </>
        )}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-xs text-slate-500">Rough is fine. Move them as things change.</p>
          <label className="mt-2 block text-xs font-medium text-slate-600">
            Start
            <input id={`from-${row.name}`} type="date" className={`${box} mt-1`} value={row.start_on ?? ""} onChange={(e) => onSave(row.name, { start_on: e.target.value || null })} />
          </label>
          <label className="mt-2 block text-xs font-medium text-slate-600">
            Aim to finish
            <input id={`to-${row.name}`} type="date" className={`${box} mt-1`} value={row.target_on ?? ""} onChange={(e) => onSave(row.name, { target_on: e.target.value || null })} />
          </label>
          {from || to ? (
            <button
              type="button"
              onClick={() => {
                onSave(row.name, { start_on: null, target_on: null });
                setOpen(false);
              }}
              className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Clear dates
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The next 12 weeks: a bar per dated project, months across the top, a line for today. */
function Timeline({ rows }: { rows: Row[] }) {
  const [now] = useState(() => Date.now());
  const start = mondayOf(now);
  const end = start + WEEKS * 7 * DAY;
  const at = (t: number) => Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100));
  const dated = rows
    .filter((r) => r.start_on || r.target_on)
    .sort((a, b) => (parseDay(a.start_on) ?? parseDay(a.target_on)!) - (parseDay(b.start_on) ?? parseDay(b.target_on)!));
  const undated = rows.filter((r) => !r.start_on && !r.target_on);
  const weeks = Array.from({ length: WEEKS }, (_, i) => start + i * 7 * DAY);

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 pb-4 pt-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium tracking-[-0.01em] text-slate-950">The next 12 weeks</h2>
        <p className="text-xs text-slate-400">Rough dates. Set them in the When column.</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="relative min-w-[46rem]">
          <div className="grid grid-cols-[11rem_minmax(0,1fr)]">
            <span />
            <div className="relative grid pt-6" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
              {weeks.map((w) => (
                <span key={w} className="border-l border-slate-100 pb-1.5 pl-1.5 text-[11px] tabular-nums text-slate-400">
                  {short(w)}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            {dated.map((r) => {
              const from = parseDay(r.start_on) ?? parseDay(r.target_on)!;
              const to = (parseDay(r.target_on) ?? from) + DAY;
              const left = at(from);
              const width = Math.max(at(to) - left, 1.5);
              return (
                <div key={r.name} className="grid grid-cols-[11rem_minmax(0,1fr)] items-center">
                  <span className="truncate pr-3 text-sm text-slate-700" title={r.goal ?? r.name}>
                    {r.name}
                  </span>
                  <div className="relative h-7">
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }} aria-hidden>
                      {weeks.map((w) => (
                        <span key={w} className="border-l border-slate-100" />
                      ))}
                    </div>
                    {to < start || from > end ? (
                      <span className="absolute inset-y-0 left-2 flex items-center text-xs text-slate-400">Outside these 12 weeks</span>
                    ) : (
                      <span
                        className={`absolute inset-y-1 z-10 flex items-center overflow-hidden rounded-full px-2.5 text-xs font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.12)] ${STAGE_TONE[r.stage].bar}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${r.name}: ${short(from)} to ${short(to - DAY)}`}
                      >
                        <span className="truncate">
                          {short(from)} → {short(to - DAY)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Today, across every row. */}
          <div className="pointer-events-none absolute bottom-0 top-0 grid w-full grid-cols-[11rem_minmax(0,1fr)]" aria-hidden>
            <span />
            <div className="relative">
              <span className="absolute bottom-0 top-4 w-px bg-rose-400" style={{ left: `${at(now)}%` }} />
              <span className="absolute top-0 -translate-x-1/2 rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold leading-4 text-white" style={{ left: `${at(now)}%` }}>
                Today
              </span>
            </div>
          </div>
        </div>
      </div>
      {undated.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-400">No dates yet</span>
          {undated.map((r) => (
            <span key={r.name} className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_TONE[r.stage].chip}`}>
              {r.name}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Where each project sits: top right is worth most for the least effort. */
function ProjectGrid({ rows }: { rows: Row[] }) {
  const scored = rows.filter((r) => r.impact && r.ease);
  const unscored = rows.filter((r) => !(r.impact && r.ease));
  const scores = [1, 2, 3, 4, 5];
  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white px-4 pb-4 pt-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium tracking-[-0.01em] text-slate-950">Where each project sits</h2>
        <p className="text-xs text-slate-400">Top right: worth most for the least effort. Parked left out.</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="grid min-w-[40rem] grid-cols-[1.5rem_repeat(5,minmax(0,1fr))] gap-1">
          {[5, 4, 3, 2, 1].map((impact) => (
            <div key={impact} className="contents">
              <span className="flex items-center justify-center text-xs font-semibold tabular-nums text-slate-500" title={`Impact ${impact}: ${ROADMAP_IMPACT_LEVELS[impact]}`}>
                {impact}
              </span>
              {scores.map((ease) => (
                <div key={ease} className={`flex min-h-14 flex-wrap content-start gap-1 rounded-lg p-1.5 ${impact >= 4 && ease >= 3 ? "bg-emerald-50/80" : "bg-slate-50"}`}>
                  {scored
                    .filter((r) => r.impact === impact && r.ease === ease)
                    .map((r) => (
                      <span key={r.name} title={r.goal ?? undefined} className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_TONE[r.stage].chip}`}>
                        {r.name}
                      </span>
                    ))}
                </div>
              ))}
            </div>
          ))}
          <span />
          {scores.map((ease) => (
            <span key={ease} className="pt-1 text-center text-[11px] text-slate-400">
              {PROJECT_EASE_LEVELS[ease]}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {(["now", "next", "later"] as const).map((st) => (
          <span key={st} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STAGE_TONE[st].dot}`} />
            {PROJECT_STAGE_META[st].label}
          </span>
        ))}
        {unscored.length ? <span className="text-slate-400">· Not scored: {unscored.map((r) => r.name).join(", ")}</span> : null}
      </div>
    </section>
  );
}

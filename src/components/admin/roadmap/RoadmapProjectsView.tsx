"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, Loader2, Plus } from "lucide-react";
import {
  PROJECT_EASE_LEVELS,
  PROJECT_STAGE_META,
  PROJECT_STAGES,
  type ProjectStage,
  healthOf,
  type RoadmapInitiative,
  type RoadmapProject,
  type RoadmapProjectUpdate,
} from "@/lib/roadmap/projectTypes";
import { ROADMAP_IMPACT_LEVELS, type RoadmapJob } from "@/lib/roadmap/types";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";
import { InitiativeIcon } from "./InitiativeIcon";
import { HealthChip } from "./roadmapHealth";
import { JobIcon, ProjectIcon } from "./roadmapIcons";
import { Caret, MetaDropdown, ScoreBarsPair, ScoreDropdown, StatusIcon, useDismiss } from "./roadmapUi";
import { RoadmapProjectsViewV1 } from "./RoadmapProjectsViewV1";

/**
 * Projects view: one row per project, in the List view's look (sticky column
 * headings, big group headings, coloured score pills). A loose 12-week
 * timeline on top; Now, Next, Later and Parked below; where each project sits
 * on impact and ease at the foot. The goal opens under a row, not in it.
 */

/** Which piece the Projects tab shows: the table, the impact and ease grid, or the 12-week timeline. */
export type ProjectsShow = "list" | "board" | "graph" | "timeline";

type Props = {
  show: ProjectsShow;
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

/** Now is the brand navy, Next the sky, Done green. */
export const STAGE_TONE: Record<ProjectStage, { dot: string; bar: string; pill: string; chip: string }> = {
  now: { dot: "bg-[#0c5290]", bar: "bg-[#0c5290]", pill: "bg-[#0c5290] text-white", chip: "bg-[#0c5290] text-white" },
  next: { dot: "bg-sky-500", bar: "bg-sky-500", pill: "bg-sky-100 text-sky-800", chip: "bg-sky-100 text-sky-900" },
  done: { dot: "bg-emerald-500", bar: "bg-emerald-400", pill: "bg-emerald-100 text-emerald-800", chip: "bg-emerald-50 text-emerald-900" },
};

const COLUMNS = [
  { key: "project", label: "Project", width: 300 },
  // Open jobs as one number, like Projects on Initiatives; beside "Where it stands" until Zander picks.
  { key: "count", label: "Jobs", width: 70 },
  { key: "jobs", label: "Where it stands", width: 290 },
  // Impact and ease sit side by side, each just wide enough for its bars.
  { key: "impact", label: "Impact", width: 64 },
  { key: "ease", label: "Ease", width: 64 },
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

export function counts(jobs: RoadmapJob[]) {
  const n = (statuses: string[]) => jobs.filter((j) => statuses.includes(j.status)).length;
  return {
    todo: n(["up_next", "todo"]),
    building: n(["in_progress"]),
    review: n(["review"]),
    ready: n(["done", "staged"]),
    live: n(["live"]),
    shipped: n(["done", "staged", "live"]),
  };
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
  if (props.show !== "list") return <ProjectsTable {...props} />;
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

function ProjectsTable({ show, jobs, authHeaders, onOpenProject, stickyTop }: Props) {
  const [saved, setSaved] = useState<RoadmapProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initiatives, setInitiatives] = useState<RoadmapInitiative[]>([]);
  /** Each project's latest update, for the health chip on board cards. */
  const [latest, setLatest] = useState<Map<string, RoadmapProjectUpdate>>(() => new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["done"]));
  const [openRows, setOpenRows] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await authHeaders();
      if (!headers || cancelled) return;
      const [res, iniRes, updRes] = await Promise.all([
        fetch("/api/admin/roadmap/projects", { headers }).catch(() => null),
        fetch("/api/admin/roadmap/initiatives", { headers }).catch(() => null),
        fetch("/api/admin/roadmap/projects/updates", { headers }).catch(() => null),
      ]);
      const body = (await res?.json().catch(() => null)) as { projects?: RoadmapProject[]; error?: string } | null;
      const iniBody = (await iniRes?.json().catch(() => null)) as { initiatives?: RoadmapInitiative[] } | null;
      const updBody = (await updRes?.json().catch(() => null)) as { updates?: RoadmapProjectUpdate[] } | null;
      if (cancelled) return;
      if (!res?.ok || !body?.projects) setError(body?.error ?? "Could not load projects.");
      else setSaved(body.projects);
      setInitiatives(iniBody?.initiatives ?? []);
      setLatest(new Map((updBody?.updates ?? []).map((u) => [u.project, u])));
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
        : { name, stage: "next" as const, goal: null, impact: null, ease: null, start_on: null, target_on: null, sort_order: 999, updated_at: "", initiative_id: null, brief: null, saved: false };
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
        : [...list, { name, stage: "next", goal: null, impact: null, ease: null, start_on: null, target_on: null, sort_order: 999, updated_at: "", initiative_id: null, brief: null, ...patch }];
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
  type Group = { key: string; rows: Row[]; heading: (open: boolean, toggle: () => void) => React.ReactNode };
  const groups: Group[] = PROJECT_STAGES.map((stage) => ({
          key: stage,
          rows: inStage(stage),
          heading: (open, toggle) => (
            <button
              type="button"
              aria-expanded={open}
              onClick={toggle}
              title={PROJECT_STAGE_META[stage].hint}
              className="inline-flex items-center gap-2.5 py-1 text-left"
            >
              <Caret open={open} />
              <span className={`h-2 w-2 rounded-full ${STAGE_TONE[stage].dot}`} />
              <span className="text-lg font-medium tracking-[-0.01em] text-slate-950">{PROJECT_STAGE_META[stage].label}</span>
              <span className="text-sm tabular-nums text-slate-400">{inStage(stage).length}</span>
              <span className="hidden text-xs text-slate-400 sm:inline">{PROJECT_STAGE_META[stage].hint}</span>
            </button>
          ),
        }));

  return (
    <div className="mt-4 pb-6">
      {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}

      {show === "timeline" ? <Timeline rows={[...inStage("now"), ...inStage("next")]} onOpen={onOpenProject} /> : null}
      {show === "board" ? (
        <ProjectBoard
          columns={PROJECT_STAGES.map((stage) => ({ stage, rows: inStage(stage) }))}
          jobsBy={jobsBy}
          initiatives={initiatives}
          latest={latest}
          onOpen={onOpenProject}
          onMove={(name, stage) => void save(name, { stage })}
        />
      ) : null}
      {show === "graph" ? <ProjectGrid rows={rows.filter((r) => r.stage !== "done")} onOpen={onOpenProject} /> : null}
      {show === "list" ? (
        <>

          {/* Sideways scroll only below lg: an overflow box would stop the headings sticking. */}
          <div className="mt-2 overflow-x-auto lg:overflow-visible">
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
              {groups.map((group, gi) => {
                const open = !collapsed.has(group.key);
                const toggle = () =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.key)) next.delete(group.key);
                    else next.add(group.key);
                    return next;
                  });
                return (
                  <tbody key={group.key}>
                    <tr>
                      <td colSpan={COLUMNS.length} className={`pb-0.5 ${gi === 0 ? "pt-2" : "pt-5"}`}>
                        {group.heading(open, toggle)}
                      </td>
                    </tr>
                    {open
                      ? group.rows.map((row) => (
                          <ProjectRows
                            key={row.name}
                            row={row}
                            jobs={jobsBy.get(row.name) ?? []}
                            expanded={openRows.has(row.name)}
                            onToggle={() =>
                              setOpenRows((cur) => {
                                const next = new Set(cur);
                                if (next.has(row.name)) next.delete(row.name);
                                else next.add(row.name);
                                return next;
                              })
                            }
                            onSave={save}
                            onOpenJobs={() => onOpenProject(row.name)}
                          />
                        ))
                      : null}
                    {open && !group.rows.length ? (
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

        </>
      ) : null}
    </div>
  );
}

/** Open jobs first by how far along they are, then ideas and parked. */
export const JOB_ORDER = ["in_progress", "review", "done", "staged", "up_next", "todo", "evaluate", "parked"];

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
  // Every job not yet live, ideas and parked ones included, so it matches the project's own page.
  const openJobs = jobs
    .filter((j) => j.status !== "live" && j.status !== "vetoed")
    .sort((a, b) => JOB_ORDER.indexOf(a.status) - JOB_ORDER.indexOf(b.status) || a.sort_order - b.sort_order);
  const ideas = jobs.filter((j) => j.status === "evaluate").length;
  const parked = jobs.filter((j) => j.status === "parked").length;
  return (
    <>
      <tr className="border-t border-slate-200 align-middle transition hover:bg-white/70">
        <td className="py-2.5 pl-1 pr-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? `Hide ${row.name}'s jobs` : `Show ${row.name}'s jobs`}
              onClick={onToggle}
              className="rounded p-1 hover:bg-slate-200/60"
            >
              <Caret open={expanded} />
            </button>
            <button
              type="button"
              onClick={onOpenJobs}
              title={row.goal ? `${row.goal}\n\nOpen this project` : "Open this project"}
              className="truncate text-ui font-medium text-slate-900 transition hover:text-[#0c5290]"
            >
              {row.name}
            </button>
            {!row.saved ? <span className="shrink-0 text-caption text-slate-400">new</span> : null}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <span
            title={`${c.todo + c.building + c.review + c.ready} to do or under way, ${ideas} ideas, ${parked} parked, ${c.live} live`}
            className="inline-flex items-center gap-1.5 text-sm tabular-nums text-slate-700"
          >
            <JobIcon className="h-4 w-4 text-slate-400" aria-hidden />
            {openJobs.length}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <JobCounts c={c} />
        </td>
        <td className="px-2 py-2">
          <ScoreDropdown label="Impact" value={row.impact} names={ROADMAP_IMPACT_LEVELS} onChange={(v) => onSave(row.name, { impact: v })} />
        </td>
        <td className="px-2 py-2">
          <ScoreDropdown label="Ease" value={row.ease} names={PROJECT_EASE_LEVELS} onChange={(v) => onSave(row.name, { ease: v })} />
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
      {expanded
        ? openJobs.map((j) => (
            <tr key={j.id} className="align-middle transition hover:bg-white/70">
              <td colSpan={COLUMNS.length} className="py-1.5 pl-[2.75rem] pr-4">
                <Link href={`/admin/roadmap/jobs/${j.job_number}`} className="group/job flex min-w-0 items-center gap-2 text-sm">
                  <StatusIcon status={j.status} />
                  <span className="w-8 shrink-0 tabular-nums text-slate-400">{j.job_number}</span>
                  <span className="truncate text-slate-700 group-hover/job:text-[#0c5290]">{j.title}</span>
                </Link>
              </td>
            </tr>
          ))
        : null}
      {expanded ? (
        <tr>
          <td colSpan={COLUMNS.length} className="pb-2.5 pl-[2.75rem] pr-4 pt-0.5 text-sm text-slate-400">
            {openJobs.length ? null : "No open jobs. "}
            {c.live ? `${c.live} live. ` : null}
            <button type="button" onClick={onOpenJobs} className="font-medium text-[#0c5290] hover:underline">
              Open the project
            </button>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function AddInitiative({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  if (!adding) {
    return (
      <button type="button" onClick={() => setAdding(true)} className="mt-4 inline-flex items-center gap-1.5 pl-[1.625rem] text-sm font-medium text-slate-500 hover:text-slate-900">
        <Plus className="h-4 w-4" aria-hidden />
        Add initiative
      </button>
    );
  }
  return (
    <form
      className="mt-4 flex items-center gap-2 pl-[1.625rem]"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onAdd(name.trim());
        setName("");
        setAdding(false);
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAdding(false);
        }}
        placeholder="Initiative name"
        className={fieldClass("input", "small", "w-72!")}
      />
      <button type="submit" className={buttonClass("main", "small")}>
        Add
      </button>
      <button type="button" onClick={() => setAdding(false)} className={buttonClass("quiet", "small")}>
        Cancel
      </button>
    </form>
  );
}

/** Where a project's jobs stand, most urgent first: yours to review, building, to do, shipped. */
/** Where a project's jobs stand: a status icon and a count each, always in workflow order. */
export function JobCounts({ c }: { c: ReturnType<typeof counts> }) {
  const parts = (
    [
      { n: c.todo, status: "todo", label: "to do" },
      { n: c.building, status: "in_progress", label: "in progress" },
      { n: c.review, status: "review", label: "to review" },
      { n: c.ready, status: "done", label: "ready or on staging" },
      { n: c.live, status: "live", label: "live" },
    ] as const
  ).filter((p) => p.n > 0);
  if (!parts.length) return <span className="text-xs text-slate-400">No jobs yet</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {parts.map((p) => (
        <span key={p.status} title={`${p.n} ${p.label}`} className="inline-flex items-center gap-1 text-sm tabular-nums text-slate-700">
          <StatusIcon status={p.status} />
          {p.n}
        </span>
      ))}
    </span>
  );
}

export function StagePill({ stage }: { stage: ProjectStage }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${STAGE_TONE[stage].pill}`}>
      {PROJECT_STAGE_META[stage].label}
    </span>
  );
}

/** "19 Oct → 6 Nov · 3 wks", or Add dates; opens two date boxes. */
export function DatesPicker({ row, onSave }: { row: RoadmapProject; onSave: (name: string, patch: Partial<RoadmapProject>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const from = parseDay(row.start_on);
  const to = parseDay(row.target_on);
  const weeks = from && to ? Math.max(1, Math.round((to - from) / (7 * DAY))) : null;
  const box = fieldClass("input", "small");
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
function Timeline({ rows, onOpen }: { rows: Row[]; onOpen: (name: string) => void }) {
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
    <section className={cardClass("plain", "px-4 pb-4 pt-3.5")}>
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
                <span key={w} className="border-l border-slate-100 pb-1.5 pl-1.5 text-caption tabular-nums text-slate-400">
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
                  <button type="button" onClick={() => onOpen(r.name)} className="truncate pr-3 text-left text-sm text-slate-700 hover:text-[#0c5290]" title={r.goal ?? r.name}>
                    {r.name}
                  </button>
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
              <span className="absolute top-0 -translate-x-1/2 rounded-full bg-rose-500 px-1.5 text-caption font-semibold leading-4 text-white" style={{ left: `${at(now)}%` }}>
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

/** Projects as a board, like Linear's: a column per stage; drag a card to move it, click to open it. */
function ProjectBoard({
  columns,
  jobsBy,
  initiatives,
  latest,
  onOpen,
  onMove,
}: {
  columns: { stage: ProjectStage; rows: Row[] }[];
  jobsBy: Map<string, RoadmapJob[]>;
  initiatives: RoadmapInitiative[];
  latest: Map<string, RoadmapProjectUpdate>;
  onOpen: (name: string) => void;
  onMove: (name: string, stage: ProjectStage) => void;
}) {
  const [over, setOver] = useState<ProjectStage | null>(null);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {columns.map(({ stage, rows }) => (
        <section
          key={stage}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(stage);
          }}
          onDragLeave={() => setOver((cur) => (cur === stage ? null : cur))}
          onDrop={(e) => {
            e.preventDefault();
            setOver(null);
            const name = e.dataTransfer.getData("text/plain");
            if (name) onMove(name, stage);
          }}
          className={`flex min-h-40 flex-col rounded-xl p-2 transition ${over === stage ? "bg-sky-50 ring-2 ring-sky-200" : "bg-slate-100/70"}`}
        >
          <h2 className="flex items-center gap-2 px-1.5 pb-2 pt-1 text-sm font-medium text-slate-900" title={PROJECT_STAGE_META[stage].hint}>
            <span className={`h-2 w-2 rounded-full ${STAGE_TONE[stage].dot}`} aria-hidden />
            {PROJECT_STAGE_META[stage].label}
            <span className="tabular-nums text-slate-400">{rows.length}</span>
          </h2>
          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const initiative = initiatives.find((i) => i.id === row.initiative_id);
              const c = counts(jobsBy.get(row.name) ?? []);
              const open = c.review + c.building + c.todo;
              return (
                <button
                  key={row.name}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", row.name);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onOpen(row.name)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-slate-300 hover:shadow-sm active:cursor-grabbing"
                >
                  <span className="flex items-start gap-2">
                    {initiative ? (
                      <InitiativeIcon initiative={initiative} size="sm" />
                    ) : (
                      <ProjectIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-900">{row.name}</span>
                  </span>
                  {row.goal ? <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-slate-500">{row.goal}</span> : null}
                  <span className="mt-2.5 flex flex-wrap items-center gap-2">
                    <ScoreBarsPair impact={row.impact} ease={row.ease} impactNames={ROADMAP_IMPACT_LEVELS} easeNames={PROJECT_EASE_LEVELS} />
                    {stage === "now" || stage === "next" ? <HealthChip health={healthOf(latest.get(row.name))} /> : null}
                    <span className="ml-auto text-xs tabular-nums text-slate-400" title={`${open} open, ${c.shipped} shipped`}>
                      {open} open · {c.shipped} live
                    </span>
                  </span>
                </button>
              );
            })}
            {!rows.length ? <p className="px-1.5 py-3 text-xs text-slate-400">Drop a project here.</p> : null}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Where each project sits: top right is worth most for the least effort. */
function ProjectGrid({ rows, onOpen }: { rows: Row[]; onOpen: (name: string) => void }) {
  const scored = rows.filter((r) => r.impact && r.ease);
  const unscored = rows.filter((r) => !(r.impact && r.ease));
  const scores = [1, 2, 3, 4, 5];
  return (
    <section className={cardClass("plain", "px-4 pb-4 pt-3.5")}>
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
                      <button key={r.name} type="button" onClick={() => onOpen(r.name)} title={r.goal ?? undefined} className={`rounded-full px-2 py-0.5 text-xs font-medium transition hover:opacity-80 ${STAGE_TONE[r.stage].chip}`}>
                        {r.name}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          ))}
          <span />
          {scores.map((ease) => (
            <span key={ease} className="pt-1 text-center text-caption text-slate-400">
              {PROJECT_EASE_LEVELS[ease]}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {(["now", "next"] as const).map((st) => (
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

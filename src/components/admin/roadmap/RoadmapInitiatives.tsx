"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { ProductCanvasToggle } from "@/components/admin/roadmap/ProductCanvasToggle";
import { StickyPageHeader } from "@/components/layout/StickyPageHeader";
import {
  INITIATIVE_STATUSES,
  INITIATIVE_STATUS_LABEL,
  PROJECT_EASE_LEVELS,
  healthOf,
  type InitiativeStatus,
  type RoadmapInitiative,
  type RoadmapProject,
  type RoadmapProjectUpdate,
} from "@/lib/roadmap/projectTypes";
import { ROADMAP_IMPACT_LEVELS, type RoadmapJob } from "@/lib/roadmap/types";
import { buttonClass } from "@/components/ui/Button";
import { InitiativeIcon, InitiativeIconPicker } from "./InitiativeIcon";
import { InitiativeNav, type InitiativeTab } from "./RoadmapPageHeaders";
import { ProjectIcon } from "./roadmapIcons";
import { NewProjectSheet } from "./NewProjectSheet";
import { AddInitiative, JobCounts, StagePill, counts } from "./RoadmapProjectsView";
import { RoadmapWriteUp } from "./RoadmapWriteUp";
import {
  HealthChip,
  HealthDots,
  InitiativeStatusDropdown,
  OwnerChip,
  OwnerDropdown,
  TargetChip,
  TargetDropdown,
} from "./roadmapHealth";
import { MetaDropdown, ScoreBarsPair } from "./roadmapUi";
import { blankProject, initiativeHref, projectHref, roadmapAuthHeaders, useRoadmapData } from "./useRoadmapData";

const STAGE_RANK = { now: 0, next: 1, later: 2, parked: 3 } as const;

/** An initiative's projects, Now first. */
function projectsIn(initiativeId: string, projects: RoadmapProject[]): RoadmapProject[] {
  return projects
    .filter((p) => p.initiative_id === initiativeId)
    .sort((a, b) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage] || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function jobsIn(projects: RoadmapProject[], jobs: RoadmapJob[]): RoadmapJob[] {
  const names = new Set(projects.map((p) => p.name));
  return jobs.filter((j) => j.project && names.has(j.project));
}

function Progress({ jobs }: { jobs: RoadmapJob[] }) {
  const c = counts(jobs);
  const total = jobs.filter((j) => j.status !== "vetoed").length;
  if (!total) return <span className="text-xs text-slate-400">No jobs yet</span>;
  return (
    <div className="flex items-center gap-2" title={`${c.shipped} of ${total} jobs shipped`}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(c.shipped / total) * 100}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">
        {c.shipped}/{total}
      </span>
    </div>
  );
}

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_7rem_8rem_5.5rem_10rem_3.5rem] items-center gap-4";

/**
 * Product → Initiatives, like Linear's: Active is the dashboard (check Health a
 * few times a week), Planned is next quarter's thinking, Completed is done.
 */
export function RoadmapInitiativesTab() {
  const { jobs, projects, initiatives, owners, latest, error, saveInitiative, addInitiative } = useRoadmapData();
  const [status, setStatus] = useState<InitiativeStatus>("active");
  const ordered = useMemo(
    () => [...(initiatives ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [initiatives]
  );
  const shown = ordered.filter((i) => i.status === status);
  const move = (index: number, by: -1 | 1) => {
    const a = shown[index];
    const b = shown[index + by];
    if (!a || !b) return;
    void saveInitiative(a.id, { sort_order: a.sort_order === b.sort_order ? b.sort_order + by : b.sort_order });
    void saveInitiative(b.id, { sort_order: a.sort_order });
  };
  const loose = (projects ?? []).filter((p) => !p.initiative_id || !ordered.some((i) => i.id === p.initiative_id));
  const arrow = "rounded p-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700 disabled:invisible";

  return (
    <div className="w-full">
      <StickyPageHeader
        title="Product"
        description="Initiatives are the big goals; each holds projects, and projects hold jobs. Health is each running project's latest update: green on track, yellow at risk, red off track, grey when it's had no update this week."
        tabs={<LessonImportTabs />}
        actions={<ProductCanvasToggle />}
      />
      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {!jobs || !projects || !initiatives ? (
        <p className="py-10 text-sm text-slate-500">Loading initiatives…</p>
      ) : (
        <div className="mt-5 pb-12">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Initiatives by status">
            {INITIATIVE_STATUSES.map((s) => {
              const n = ordered.filter((i) => i.status === s).length;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={status === s}
                  onClick={() => setStatus(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
                    status === s
                      ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                      : "border-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-800"
                  }`}
                >
                  {INITIATIVE_STATUS_LABEL[s]}
                  <span className="tabular-nums text-slate-400">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[46rem]">
              <div className={`${COLUMNS} border-b border-slate-200 px-2 pb-2 text-xs font-medium text-slate-500`}>
                <span>Name</span>
                <span>Target</span>
                <span>Owner</span>
                <span>Projects</span>
                <span>Health</span>
                <span />
              </div>
              {shown.length ? (
                <ul>
                  {shown.map((ini, i) => {
                    const mine = projectsIn(ini.id, projects);
                    return (
                      <li key={ini.id} className="group/row relative border-b border-slate-200">
                        <div className={`${COLUMNS} px-2 py-3 transition group-hover/row:bg-white/70`}>
                          <Link href={initiativeHref(ini.id)} className="flex min-w-0 items-center gap-3 after:absolute after:inset-0">
                            <InitiativeIcon initiative={ini} />
                            <span className="min-w-0">
                              <span className="block truncate text-ui font-medium text-slate-900 group-hover/row:text-[#0c5290]">{ini.name}</span>
                              {ini.goal ? <span className="mt-0.5 block truncate text-sm text-slate-500">{ini.goal}</span> : null}
                            </span>
                          </Link>
                          <TargetChip target={ini.target} />
                          <OwnerChip owner={owners.find((o) => o.id === ini.owner_id)} />
                          <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-slate-700">
                            <ProjectIcon className="h-4 w-4 text-slate-400" aria-hidden />
                            {mine.length}
                          </span>
                          <HealthDots projects={mine} latest={latest} />
                          <span className="relative z-10 flex items-center opacity-0 transition group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                            <button type="button" aria-label={`Move ${ini.name} up`} onClick={() => move(i, -1)} disabled={i === 0} className={arrow}>
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button type="button" aria-label={`Move ${ini.name} down`} onClick={() => move(i, 1)} disabled={i === shown.length - 1} className={arrow}>
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-2 py-6 text-sm text-slate-400">
                  {status === "planned"
                    ? "Nothing planned yet. Add the next big goal you're shaping."
                    : status === "completed"
                      ? "Nothing completed yet."
                      : "Nothing active. Move a planned initiative to Active on its page."}
                </p>
              )}
            </div>
          </div>
          {status !== "completed" ? <AddInitiative onAdd={(name) => void addInitiative(name, status)} /> : null}
          {loose.length ? (
            <p className="mt-6 text-sm text-slate-500">
              Not in an initiative yet:{" "}
              {loose.map((p, i) => (
                <span key={p.name}>
                  {i ? ", " : ""}
                  <Link href={projectHref(p.name)} className="font-medium text-slate-700 hover:text-[#0c5290]">
                    {p.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** An initiative's own pages, like Linear: Overview (the write-up and details), Updates (its projects' updates together), Projects. */

function useInitiative(id: string) {
  const data = useRoadmapData();
  const { jobs, projects, initiatives } = data;
  const initiative = initiatives?.find((i) => i.id === id) ?? null;
  const loading = !jobs || !projects || !initiatives;
  const mine = initiative && projects ? projectsIn(initiative.id, projects) : [];
  return { ...data, initiative, loading, mine };
}

function InitiativeShell({
  id,
  tab,
  state,
  children,
}: {
  id: string;
  tab: InitiativeTab;
  state: ReturnType<typeof useInitiative>;
  children: (initiative: RoadmapInitiative) => React.ReactNode;
}) {
  return (
    <div className="w-full">
      <StickyPageHeader title="Product" tabs={<LessonImportTabs />}
        actions={<ProductCanvasToggle />} />
      <InitiativeNav initiative={state.initiative} id={id} active={tab} />
      {state.error ? <p className="mt-4 text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state.loading ? <p className="py-10 text-sm text-slate-500">Loading the initiative…</p> : null}
      {!state.loading && !state.initiative ? (
        <p className="py-10 text-sm text-slate-500">
          That initiative is gone.{" "}
          <Link href="/admin/roadmap/initiatives" className="font-medium text-[#0c5290] hover:underline">
            See all initiatives
          </Link>
        </p>
      ) : null}
      {!state.loading && state.initiative ? children(state.initiative) : null}
    </div>
  );
}

export function RoadmapInitiativeOverview({ id }: { id: string }) {
  const state = useInitiative(id);
  const { initiative, mine, jobs, owners, latest, saveInitiative } = state;
  const save = (patch: Partial<RoadmapInitiative>) => void saveInitiative(id, patch);
  // The boxes follow the saved name and goal (they arrive after the first load).
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [saved, setSaved] = useState<{ name?: string; goal?: string | null }>({});
  if (saved.name !== initiative?.name || saved.goal !== initiative?.goal) {
    setSaved({ name: initiative?.name, goal: initiative?.goal });
    setName(initiative?.name ?? "");
    setGoal(initiative?.goal ?? "");
  }

  return (
    <InitiativeShell id={id} tab="overview" state={state}>
      {(ini) => (
        <div className="mt-8 grid gap-12 pb-16 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <main className="min-w-0 max-w-3xl">
            <InitiativeIconPicker initiative={ini} onChange={save} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name.trim() !== ini.name) save({ name: name.trim() });
                else setName(ini.name);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              aria-label="Initiative name"
              className="mt-4 w-full border-0 bg-transparent p-0 text-[2rem] font-semibold leading-tight tracking-tight text-slate-950 focus:outline-none focus:ring-0"
            />
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onBlur={() => {
                if (goal.trim() !== (ini.goal ?? "")) save({ goal: goal.trim() || null });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="Add a short summary…"
              aria-label="Summary"
              className="mt-2 w-full border-0 bg-transparent p-0 text-lg text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />

            {/* Properties as a row of pills, like Linear. */}
            <div className="mt-5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-slate-200 bg-white px-1 transition hover:border-slate-300">
                <InitiativeStatusDropdown value={ini.status} onChange={(status) => save({ status })} />
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-1 transition hover:border-slate-300">
                <TargetDropdown value={ini.target} onChange={(target) => save({ target })} />
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-1 transition hover:border-slate-300">
                <OwnerDropdown value={ini.owner_id} owners={owners} onChange={(owner_id) => save({ owner_id })} />
              </span>
              <Link
                href={initiativeHref(id, "updates")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 transition hover:border-slate-300"
                title="Health: each running project's latest update"
              >
                <HealthDots projects={mine} latest={latest} />
              </Link>
            </div>

            <section className="mt-10">
              <h2 className="mb-3 text-sm font-medium text-slate-500">Description</h2>
              <RoadmapWriteUp
                value={ini.brief}
                onSave={(brief) => save({ brief })}
                placeholder="Write the goal behind this initiative, notes, research and ideas…"
              />
            </section>
          </main>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <h2 className="text-sm font-medium text-slate-900">Progress</h2>
              <div className="mt-3 space-y-3 text-sm">
                <p className="inline-flex items-center gap-1.5 tabular-nums text-slate-700">
                  <ProjectIcon className="h-4 w-4 text-slate-400" aria-hidden />
                  {mine.length} {mine.length === 1 ? "project" : "projects"}
                </p>
                <Progress jobs={jobsIn(mine, jobs ?? [])} />
                <Link href={initiativeHref(id, "projects")} className="block text-sm font-medium text-[#0c5290] hover:underline">
                  Open its projects
                </Link>
              </div>
            </section>
          </aside>
        </div>
      )}
    </InitiativeShell>
  );
}

/** Every update from the initiative's projects in one place: where each stands, then the feed. */
export function RoadmapInitiativeUpdates({ id }: { id: string }) {
  const state = useInitiative(id);
  const { mine, latest } = state;
  const names = mine.map((p) => p.name).join("\n");
  const [updates, setUpdates] = useState<RoadmapProjectUpdate[] | null>(null);
  useEffect(() => {
    if (!names) return;
    let cancelled = false;
    void (async () => {
      const headers = await roadmapAuthHeaders();
      if (!headers || cancelled) return;
      const query = names.split("\n").map((n) => `project=${encodeURIComponent(n)}`).join("&");
      const res = await fetch(`/api/admin/roadmap/projects/updates?${query}`, { headers }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { updates?: RoadmapProjectUpdate[] } | null;
      if (!cancelled) setUpdates(data?.updates ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [names]);

  return (
    <InitiativeShell id={id} tab="updates" state={state}>
      {() => (
        <div className="mt-6 max-w-3xl pb-12">
          <h2 className="text-lg font-medium tracking-[-0.01em] text-slate-950">Where each project stands</h2>
          {mine.length ? (
            <ul className="mt-2">
              {mine.map((p) => {
                const last = latest.get(p.name);
                return (
                  <li key={p.name} className="border-t border-slate-200 first:border-t-0">
                    <Link href={projectHref(p.name, "updates")} className="flex flex-wrap items-center gap-3 rounded-md px-2 py-2.5 transition hover:bg-white">
                      <ProjectIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{p.name}</span>
                      <span className="text-xs tabular-nums text-slate-400">{last ? shortDay(last.created_at) : "No update yet"}</span>
                      <HealthChip health={healthOf(last)} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No projects yet.</p>
          )}

          <h2 className="mt-10 text-lg font-medium tracking-[-0.01em] text-slate-950">All updates</h2>
          {!mine.length ? null : updates === null ? (
            <p className="mt-3 text-sm text-slate-400">Loading updates…</p>
          ) : updates.length ? (
            <ol className="mt-4 space-y-5">
              {updates.map((u) => (
                <li key={u.id} className="border-l-2 border-slate-200 pl-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Link href={projectHref(u.project, "updates")} className="font-medium text-slate-800 hover:text-[#0c5290]">
                      {u.project}
                    </Link>
                    <HealthChip health={u.health} />
                    <span>{u.author_name ?? "Admin"}</span>
                    <span className="tabular-nums">{shortDay(u.created_at)}</span>
                  </div>
                  {u.body ? <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{u.body}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No updates yet. Post one from a project&apos;s Updates tab.</p>
          )}
        </div>
      )}
    </InitiativeShell>
  );
}

function shortDay(at: string): string {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The initiative's projects, with a picker to add more. */
export function RoadmapInitiativeProjects({ id }: { id: string }) {
  const state = useInitiative(id);
  const { mine, jobs, projects, initiatives, latest, saveProject } = state;
  const [creating, setCreating] = useState(false);
  // Projects to add: saved ones elsewhere, plus names that only appear on jobs so far.
  const addable = useMemo(() => {
    const names = new Set([...(projects ?? []).map((p) => p.name), ...(jobs ?? []).map((j) => j.project).filter((p): p is string => Boolean(p))]);
    return [...names]
      .map((n) => (projects ?? []).find((p) => p.name === n) ?? blankProject(n))
      .filter((p) => p.initiative_id !== id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, jobs, id]);

  return (
    <InitiativeShell id={id} tab="projects" state={state}>
      {() => (
        <div className="mt-6 max-w-4xl pb-12">
          {mine.length ? (
            <ul>
              {mine.map((p) => (
                <li key={p.name} className="border-t border-slate-200 first:border-t-0">
                  <Link href={projectHref(p.name)} className="flex flex-wrap items-center gap-3 rounded-md px-2 py-2.5 transition hover:bg-white">
                    <ProjectIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>
                      {p.goal ? <span className="block truncate text-xs text-slate-500">{p.goal}</span> : null}
                    </span>
                    <JobCounts c={counts((jobs ?? []).filter((j) => j.project === p.name))} />
                    <ScoreBarsPair impact={p.impact} ease={p.ease} impactNames={ROADMAP_IMPACT_LEVELS} easeNames={PROJECT_EASE_LEVELS} />
                    {p.stage === "now" || p.stage === "next" ? <HealthChip health={healthOf(latest.get(p.name))} /> : null}
                    <StagePill stage={p.stage} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No projects yet.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setCreating(true)} className={buttonClass("second", "small")}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New project
            </button>
            {addable.length ? (
              <div>
                <MetaDropdown
                  bare
                  display={
                    <span className={buttonClass("quiet", "small")}>
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Add project
                    </span>
                  }
                  options={addable.map((p) => ({
                    key: p.name,
                    selected: false,
                    onSelect: () => void saveProject(p.name, { initiative_id: id }),
                    node: (
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="truncate">{p.name}</span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {initiatives?.find((i) => i.id === p.initiative_id)?.name ?? "No initiative"}
                        </span>
                      </span>
                    ),
                  }))}
                />
              </div>
            ) : null}
          </div>
          {creating ? <NewProjectSheet initiatives={initiatives ?? []} defaultInitiativeId={id} onClose={() => setCreating(false)} /> : null}
        </div>
      )}
    </InitiativeShell>
  );
}

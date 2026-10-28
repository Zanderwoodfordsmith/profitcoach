"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Gauge, SquarePen, Zap } from "lucide-react";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { ProductCanvasToggle } from "@/components/admin/roadmap/ProductCanvasToggle";
import { StickyPageHeader } from "@/components/layout/StickyPageHeader";
import {
  PROJECT_EASE_LEVELS,
  PROJECT_STAGE_META,
  PROJECT_STAGES,
  healthOf,
  type RoadmapProject,
  type RoadmapProjectUpdate,
} from "@/lib/roadmap/projectTypes";
import { ROADMAP_IMPACT_LEVELS } from "@/lib/roadmap/types";
import { InitiativeIcon } from "./InitiativeIcon";
import { ProjectUpdates } from "./ProjectUpdates";
import { RoadmapJobsBoard } from "./RoadmapJobsBoard";
import { ProjectNav, type ProjectTab } from "./RoadmapPageHeaders";
import { InitiativesIcon, JobIcon, ProjectIcon } from "./roadmapIcons";
import { HealthChip } from "./roadmapHealth";
import { DatesPicker, JobCounts, STAGE_TONE, StagePill, counts } from "./RoadmapProjectsView";
import { RoadmapWriteUp } from "./RoadmapWriteUp";
import { MetaDropdown } from "./roadmapUi";
import { PropertyPill, ScorePillDropdown } from "./roadmapPills";
import { blankProject, projectHref, useRoadmapData } from "./useRoadmapData";

/** A project's own pages, like Linear: Overview (the write-up and details), Updates, and Jobs (the board, just this project). */

function useProject(name: string) {
  const data = useRoadmapData();
  const { jobs, projects, initiatives } = data;
  const project: RoadmapProject = useMemo(
    () => projects?.find((p) => p.name === name) ?? blankProject(name),
    [projects, name]
  );
  const mine = useMemo(() => (jobs ?? []).filter((j) => j.project === name), [jobs, name]);
  const initiative = initiatives?.find((i) => i.id === project.initiative_id) ?? null;
  const loading = !jobs || !projects || !initiatives;
  const unknown = !loading && !projects.some((p) => p.name === name) && mine.length === 0;
  return { ...data, project, mine, initiative, loading, unknown };
}

/** The header and the loading or not-found states every tab shares. */
function ProjectShell({
  name,
  tab,
  state,
  children,
}: {
  name: string;
  tab: ProjectTab;
  state: ReturnType<typeof useProject>;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <StickyPageHeader title="Product" tabs={<LessonImportTabs />}
        actions={<ProductCanvasToggle />} />
      <ProjectNav name={name} initiative={state.initiative} active={tab} />
      {state.error ? <p className="mt-4 text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state.loading ? <p className="py-10 text-sm text-slate-500">Loading the project…</p> : null}
      {state.unknown ? (
        <p className="py-10 text-sm text-slate-500">
          No project has that name.{" "}
          <Link href="/admin/roadmap/projects" className="font-medium text-[#0c5290] hover:underline">
            See all projects
          </Link>
        </p>
      ) : null}
      {!state.loading && !state.unknown ? children : null}
    </div>
  );
}

export function RoadmapProjectOverview({ name }: { name: string }) {
  const state = useProject(name);
  const { project, mine, initiative, initiatives, latest, saveProject } = state;
  const save = (patch: Partial<RoadmapProject>) => void saveProject(name, patch);

  // The box follows the saved goal (it arrives after the first load).
  const [goal, setGoal] = useState(project.goal ?? "");
  const [savedGoal, setSavedGoal] = useState(project.goal);
  if (savedGoal !== project.goal) {
    setSavedGoal(project.goal);
    setGoal(project.goal ?? "");
  }

  const c = counts(mine);
  const total = mine.filter((j) => j.status !== "vetoed").length;

  const stageTone = STAGE_TONE[project.stage];
  const health = healthOf(latest.get(name));

  return (
    <ProjectShell name={name} tab="overview" state={state}>
      <div className="mt-8 grid gap-12 pb-16 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <main className="min-w-0 max-w-3xl">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600" aria-hidden>
            <ProjectIcon className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-[2rem] font-semibold leading-tight tracking-tight text-slate-950">{name}</h1>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onBlur={() => {
              if (goal.trim() !== (project.goal ?? "")) save({ goal: goal.trim() || null });
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
            <MetaDropdown
              bare
              display={
                <PropertyPill>
                  <span className={`h-2 w-2 rounded-full ${stageTone.dot}`} aria-hidden />
                  {PROJECT_STAGE_META[project.stage].label}
                </PropertyPill>
              }
              options={PROJECT_STAGES.map((st) => ({
                key: st,
                selected: project.stage === st,
                onSelect: () => save({ stage: st }),
                node: <StagePill stage={st} />,
              }))}
            />
            <MetaDropdown
              bare
              display={
                <PropertyPill muted={!initiative}>
                  {initiative ? <InitiativeIcon initiative={initiative} size="sm" /> : <InitiativesIcon className="h-3.5 w-3.5" aria-hidden />}
                  {initiative?.name ?? "Initiative"}
                </PropertyPill>
              }
              options={(initiatives ?? []).map((i) => ({
                key: i.id,
                selected: project.initiative_id === i.id,
                onSelect: () => save({ initiative_id: i.id }),
                node: (
                  <span className="inline-flex items-center gap-2">
                    <InitiativeIcon initiative={i} size="sm" />
                    {i.name}
                  </span>
                ),
              }))}
              onClear={project.initiative_id ? () => save({ initiative_id: null }) : undefined}
            />
            <ScorePillDropdown label="Impact" icon={Zap} value={project.impact} names={ROADMAP_IMPACT_LEVELS} onChange={(impact) => save({ impact })} />
            <ScorePillDropdown label="Ease" icon={Gauge} value={project.ease} names={PROJECT_EASE_LEVELS} onChange={(ease) => save({ ease })} />
            <DatesPicker row={project} onSave={(_, patch) => save(patch)} />
            {project.stage === "now" || project.stage === "next" ? (
              <Link href={projectHref(name, "updates")} className="rounded-full transition hover:opacity-80">
                <HealthChip health={health} />
              </Link>
            ) : null}
          </div>

          <LatestUpdate name={name} update={latest.get(name)} />

          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium text-slate-500">Description</h2>
            <RoadmapWriteUp
              value={project.brief}
              onSave={(brief) => save({ brief })}
              placeholder="Write a description, a project brief, or collect ideas…"
            />
          </section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 className="text-sm font-medium text-slate-900">Progress</h2>
            <div className="mt-3 space-y-3">
              <JobCounts c={c} />
              {total ? (
                <div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" title={`${c.shipped} of ${total} shipped`}>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(c.shipped / total) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs tabular-nums text-slate-500">
                    {c.shipped} of {total} jobs shipped
                  </p>
                </div>
              ) : null}
              <Link href={projectHref(name, "jobs")} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0c5290] hover:underline">
                <JobIcon className="h-3.5 w-3.5" aria-hidden />
                Open its jobs
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </ProjectShell>
  );
}

/** The newest update on the Overview, like Linear's; or a nudge to write the first. */
function LatestUpdate({ name, update }: { name: string; update: RoadmapProjectUpdate | undefined }) {
  if (!update) {
    return (
      <Link
        href={projectHref(name, "updates")}
        className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
      >
        <SquarePen className="h-4 w-4" aria-hidden />
        Write the first project update
      </Link>
    );
  }
  return (
    <Link
      href={projectHref(name, "updates")}
      className="mt-8 block rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300"
    >
      <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <HealthChip health={healthOf(update)} />
        <span>Latest update from {update.author_name ?? "Admin"}</span>
        <span className="tabular-nums">
          {new Date(update.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
      </span>
      {update.body ? <span className="mt-1.5 line-clamp-3 block whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{update.body}</span> : null}
    </Link>
  );
}

export function RoadmapProjectUpdatesTab({ name }: { name: string }) {
  const state = useProject(name);
  return (
    <ProjectShell name={name} tab="updates" state={state}>
      <div className="max-w-3xl pb-12">
        <ProjectUpdates project={name} onPosted={state.noteUpdate} />
      </div>
    </ProjectShell>
  );
}

/** The real jobs board, showing only this project; new jobs join it. */
export function RoadmapProjectJobsTab({ name }: { name: string }) {
  const { initiative } = useProject(name);
  return <RoadmapJobsBoard project={name} subheader={<ProjectNav name={name} initiative={initiative} active="jobs" />} />;
}

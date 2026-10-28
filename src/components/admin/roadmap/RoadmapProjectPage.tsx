"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gauge, Zap } from "lucide-react";
import { cardClass } from "@/components/ui/Card";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { ProductCanvasToggle } from "@/components/admin/roadmap/ProductCanvasToggle";
import { StickyPageHeader } from "@/components/layout/StickyPageHeader";
import {
  PROJECT_EASE_LEVELS,
  PROJECT_STAGE_META,
  PROJECT_STAGES,
  type RoadmapProject,
} from "@/lib/roadmap/projectTypes";
import { ROADMAP_IMPACT_LEVELS } from "@/lib/roadmap/types";
import { ProjectUpdates } from "./ProjectUpdates";
import { RoadmapJobsBoard } from "./RoadmapJobsBoard";
import { ProjectNav } from "./RoadmapPageHeaders";
import { ProjectIcon } from "./roadmapIcons";
import { DatesPicker, JOB_ORDER, STAGE_TONE, StagePill, counts } from "./RoadmapProjectsView";
import { RoadmapWriteUp } from "./RoadmapWriteUp";
import { MetaDropdown, StatusIcon } from "./roadmapUi";
import { PropertyPill, ScorePillDropdown } from "./roadmapPills";
import { blankProject, projectHref, useRoadmapData } from "./useRoadmapData";

function useProject(name: string) {
  const data = useRoadmapData();
  const { jobs, projects } = data;
  const project: RoadmapProject = useMemo(
    () => projects?.find((p) => p.name === name) ?? blankProject(name),
    [projects, name]
  );
  const mine = useMemo(() => (jobs ?? []).filter((j) => j.project === name), [jobs, name]);
  const loading = !jobs || !projects;
  const unknown = !loading && !projects.some((p) => p.name === name) && mine.length === 0;
  return { ...data, project, mine, loading, unknown };
}

/** Product's top bar and the loading or not-found states. */
function ProjectShell({ state, children }: { state: ReturnType<typeof useProject>; children: React.ReactNode }) {
  return (
    <div className="w-full">
      <StickyPageHeader title="Product" tabs={<LessonImportTabs />} actions={<ProductCanvasToggle />} />
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

/**
 * One page per project (28 Oct): the name and its properties over the
 * description on the left; one panel on the right with its jobs, then its
 * updates as a comment thread. No tabs; Zander is a team of one.
 */
export function RoadmapProjectOverview({ name }: { name: string }) {
  const state = useProject(name);
  const { project, mine, saveProject, noteUpdate } = state;
  const save = (patch: Partial<RoadmapProject>) => void saveProject(name, patch);

  // The box follows the saved goal (it arrives after the first load).
  const [goal, setGoal] = useState(project.goal ?? "");
  const [savedGoal, setSavedGoal] = useState(project.goal);
  if (savedGoal !== project.goal) {
    setSavedGoal(project.goal);
    setGoal(project.goal ?? "");
  }

  const c = counts(mine);
  const openJobs = mine
    .filter((j) => j.status !== "live" && j.status !== "vetoed")
    .sort((a, b) => JOB_ORDER.indexOf(a.status) - JOB_ORDER.indexOf(b.status) || a.sort_order - b.sort_order);
  const stageTone = STAGE_TONE[project.stage];

  return (
    <ProjectShell state={state}>
      <div className="mt-6 grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <div className="min-w-0">
          <Link
            href="/admin/roadmap/projects"
            className="inline-flex items-center gap-1 text-caption font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All projects
          </Link>

          <div className="mt-4 flex items-start gap-3.5">
            <span
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                project.stage === "done" ? "bg-emerald-50 text-emerald-700" : "bg-[#0c5290]/[0.08] text-[#0c5290]"
              }`}
              aria-hidden
            >
              <ProjectIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-title leading-tight text-slate-950">{name}</h1>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onBlur={() => {
                  if (goal.trim() !== (project.goal ?? "")) save({ goal: goal.trim() || null });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                placeholder="What finished looks like, in one line…"
                aria-label="Goal"
                className="mt-1 w-full border-0 bg-transparent p-0 text-ui text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-b border-slate-300/60 pb-5 sm:pl-[3.625rem]">
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
            <ScorePillDropdown label="Impact" icon={Zap} value={project.impact} names={ROADMAP_IMPACT_LEVELS} onChange={(impact) => save({ impact })} />
            <ScorePillDropdown label="Ease" icon={Gauge} value={project.ease} names={PROJECT_EASE_LEVELS} onChange={(ease) => save({ ease })} />
            <DatesPicker row={project} onSave={(_, patch) => save(patch)} />
          </div>

          <div className="mt-6">
            <RoadmapWriteUp
              value={project.brief}
              onSave={(brief) => save({ brief })}
              placeholder="Write a description, a project brief, or collect ideas…"
            />
          </div>
        </div>

        <aside className={cardClass("plain", "divide-y divide-slate-100 self-start lg:sticky lg:top-24")}>
          <section className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-ui font-medium text-slate-950">
                Jobs <span className="ml-1 font-normal tabular-nums text-slate-400">{openJobs.length}</span>
              </h2>
              <Link href={projectHref(name, "jobs")} className="text-caption font-medium text-[#0c5290] hover:underline">
                Open on the board
              </Link>
            </div>
            {openJobs.length ? (
              <ul className="-mx-1.5 mt-2">
                {openJobs.map((j) => (
                  <li key={j.id}>
                    <Link
                      href={`/admin/roadmap/jobs/${j.job_number}`}
                      className="group/job flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm transition hover:bg-slate-50"
                    >
                      <StatusIcon status={j.status} />
                      <span className="truncate text-slate-700 group-hover/job:text-[#0c5290]">{j.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No open jobs.</p>
            )}
            {c.live ? <p className="mt-2 text-caption tabular-nums text-slate-400">{c.live} live</p> : null}
          </section>

          <div className="p-4">
            <ProjectUpdates project={name} onPosted={noteUpdate} />
          </div>
        </aside>
      </div>
    </ProjectShell>
  );
}

/** The real jobs board, showing only this project; new jobs join it. */
export function RoadmapProjectJobsTab({ name }: { name: string }) {
  return <RoadmapJobsBoard project={name} subheader={<ProjectNav name={name} />} />;
}

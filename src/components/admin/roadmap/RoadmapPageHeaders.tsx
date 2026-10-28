"use client";

import Link from "next/link";
import { ChevronRight, FileText, MessageSquareText } from "lucide-react";
import type { RoadmapInitiative } from "@/lib/roadmap/projectTypes";
import { InitiativeIcon } from "./InitiativeIcon";
import { InitiativesIcon, JobIcon, ProjectIcon } from "./roadmapIcons";
import { initiativeHref, projectHref } from "./useRoadmapData";

/**
 * The row under Product's top bar on a project's or initiative's own page: a
 * trail back up, then the page's own tabs as pills. The top bar itself never
 * changes (it always reads Product with Initiatives, Projects, Jobs, Curriculum).
 */

export type ProjectTab = "overview" | "updates" | "jobs";
export type InitiativeTab = "overview" | "updates" | "projects";

type Pill = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean };

function Pills({ label, items }: { label: string; items: Pill[] }) {
  return (
    <nav aria-label={label} className="mt-3 flex flex-wrap items-center gap-1.5">
      {items.map(({ href, label: text, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
            active
              ? "border-slate-300 bg-white text-slate-900 shadow-sm"
              : "border-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-800"
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {text}
        </Link>
      ))}
    </nav>
  );
}

const sep = <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />;

export function ProjectNav({
  name,
  initiative,
  active,
}: {
  name: string;
  initiative: RoadmapInitiative | null;
  active: ProjectTab;
}) {
  return (
    <div className="mt-5">
      <nav aria-label="Where you are" className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <Link href="/admin/roadmap/projects" className="inline-flex items-center gap-1.5 hover:text-slate-900">
          <ProjectIcon className="h-3.5 w-3.5" aria-hidden />
          Projects
        </Link>
        {initiative ? (
          <>
            {sep}
            <Link href={initiativeHref(initiative.id)} className="inline-flex items-center gap-1.5 hover:text-slate-900">
              <InitiativeIcon initiative={initiative} size="sm" />
              {initiative.name}
            </Link>
          </>
        ) : null}
        {sep}
        <span className="font-medium text-slate-900">{name}</span>
      </nav>
      <Pills
        label={name}
        items={[
          { href: projectHref(name), label: "Overview", icon: FileText, active: active === "overview" },
          { href: projectHref(name, "updates"), label: "Updates", icon: MessageSquareText, active: active === "updates" },
          { href: projectHref(name, "jobs"), label: "Jobs", icon: JobIcon, active: active === "jobs" },
        ]}
      />
    </div>
  );
}

export function InitiativeNav({
  initiative,
  id,
  active,
}: {
  initiative: RoadmapInitiative | null;
  id: string;
  active: InitiativeTab;
}) {
  const name = initiative?.name ?? "…";
  return (
    <div className="mt-5">
      <nav aria-label="Where you are" className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <Link href="/admin/roadmap/initiatives" className="inline-flex items-center gap-1.5 hover:text-slate-900">
          <InitiativesIcon className="h-3.5 w-3.5" aria-hidden />
          Initiatives
        </Link>
        {sep}
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
          {initiative ? <InitiativeIcon initiative={initiative} size="sm" /> : null}
          {name}
        </span>
      </nav>
      <Pills
        label={name}
        items={[
          { href: initiativeHref(id), label: "Overview", icon: FileText, active: active === "overview" },
          { href: initiativeHref(id, "updates"), label: "Updates", icon: MessageSquareText, active: active === "updates" },
          { href: initiativeHref(id, "projects"), label: "Projects", icon: ProjectIcon, active: active === "projects" },
        ]}
      />
    </div>
  );
}

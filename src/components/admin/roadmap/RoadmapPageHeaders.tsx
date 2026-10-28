"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, MessageSquareText } from "lucide-react";
import type { RoadmapInitiative } from "@/lib/roadmap/projectTypes";
import { InitiativeIcon } from "./InitiativeIcon";
import { InitiativesIcon, ProjectIcon } from "./roadmapIcons";
import { initiativeHref, projectHref } from "./useRoadmapData";

/**
 * The row under Product's top bar on an initiative's own page (hidden since
 * 28 Oct): a trail back up, then its tabs as pills. Projects have one page. The top bar itself never
 * changes (it always reads Product with Initiatives, Projects, Jobs, Curriculum).
 */

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

/** Above a project's jobs on the board: the way back to the project's page. */
export function ProjectNav({ name }: { name: string }) {
  return (
    <nav aria-label="Where you are" className="mt-5 text-sm">
      <Link href={projectHref(name)} className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {name}
      </Link>
    </nav>
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

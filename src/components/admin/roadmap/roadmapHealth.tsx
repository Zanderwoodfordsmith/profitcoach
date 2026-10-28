"use client";

import { CalendarDays } from "lucide-react";
import {
  INITIATIVE_STATUSES,
  INITIATIVE_STATUS_LABEL,
  PROJECT_HEALTH_META,
  healthOf,
  targetChoices,
  targetLabel,
  type InitiativeStatus,
  type ProjectHealthShown,
  type RoadmapOwner,
  type RoadmapProject,
  type RoadmapProjectUpdate,
} from "@/lib/roadmap/projectTypes";
import { MetaDropdown } from "./roadmapUi";

/**
 * Initiatives like Linear's: target, owner, status, and health (each running
 * project's latest update; grey when it's had none for a week).
 */

/** Projects that count towards health: the ones being worked on (Now and Next). */
export function runningProjects(projects: RoadmapProject[]): RoadmapProject[] {
  return projects.filter((p) => p.stage === "now" || p.stage === "next");
}

/** Linear's order: on track, off track, at risk, then missing updates. */
const DOT_ORDER: ProjectHealthShown[] = ["on_track", "off_track", "at_risk", "missing"];

export function HealthDots({
  projects,
  latest,
}: {
  projects: RoadmapProject[];
  latest: Map<string, RoadmapProjectUpdate>;
}) {
  const running = runningProjects(projects);
  if (!running.length) return <span className="text-xs text-slate-400">No running projects</span>;
  const tally = new Map<ProjectHealthShown, string[]>();
  for (const p of running) {
    const h = healthOf(latest.get(p.name));
    tally.set(h, [...(tally.get(h) ?? []), p.name]);
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {DOT_ORDER.filter((h) => tally.has(h)).map((h) => (
        <span
          key={h}
          title={`${PROJECT_HEALTH_META[h].label}: ${tally.get(h)!.join(", ")}`}
          className="inline-flex items-center gap-1 text-sm tabular-nums text-slate-700"
        >
          <span className={`h-2 w-2 rounded-full ${PROJECT_HEALTH_META[h].dot}`} aria-hidden />
          {tally.get(h)!.length}
        </span>
      ))}
    </span>
  );
}

export function HealthChip({ health }: { health: ProjectHealthShown }) {
  const meta = PROJECT_HEALTH_META[health];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}

export function OwnerChip({ owner }: { owner: RoadmapOwner | undefined }) {
  if (!owner) return <span className="text-sm text-slate-400">No owner</span>;
  const first = owner.name.split(" ")[0];
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-slate-700">
      {owner.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={owner.avatar_url} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-caption font-semibold text-slate-600">
          {first.charAt(0)}
        </span>
      )}
      <span className="truncate">{first}</span>
    </span>
  );
}

export function TargetChip({ target }: { target: string | null }) {
  const label = targetLabel(target);
  if (!label) return <span className="text-sm text-slate-400">No target</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-slate-700">
      <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />
      {label}
    </span>
  );
}

export function OwnerDropdown({
  value,
  owners,
  onChange,
}: {
  value: string | null;
  owners: RoadmapOwner[];
  onChange: (id: string | null) => void;
}) {
  return (
    <MetaDropdown
      display={<OwnerChip owner={owners.find((o) => o.id === value)} />}
      options={owners.map((o) => ({
        key: o.id,
        selected: value === o.id,
        onSelect: () => onChange(o.id),
        node: <OwnerChip owner={o} />,
      }))}
      onClear={value ? () => onChange(null) : undefined}
    />
  );
}

export function TargetDropdown({ value, onChange }: { value: string | null; onChange: (t: string | null) => void }) {
  const choices = targetChoices();
  return (
    <MetaDropdown
      display={<TargetChip target={value} />}
      options={(value && !choices.includes(value) ? [value, ...choices] : choices).map((t) => ({
        key: t,
        selected: value === t,
        onSelect: () => onChange(t),
        node: <span className="tabular-nums">{targetLabel(t)}</span>,
      }))}
      onClear={value ? () => onChange(null) : undefined}
    />
  );
}

export function InitiativeStatusDropdown({
  value,
  onChange,
}: {
  value: InitiativeStatus;
  onChange: (s: InitiativeStatus) => void;
}) {
  return (
    <MetaDropdown
      display={<span className="text-sm font-medium text-slate-800">{INITIATIVE_STATUS_LABEL[value]}</span>}
      options={INITIATIVE_STATUSES.map((s) => ({
        key: s,
        selected: value === s,
        onSelect: () => onChange(s),
        node: <span>{INITIATIVE_STATUS_LABEL[s]}</span>,
      }))}
    />
  );
}

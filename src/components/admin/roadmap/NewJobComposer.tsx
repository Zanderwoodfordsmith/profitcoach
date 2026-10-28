"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Gauge, Tag, X, Zap } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import {
  ROADMAP_AREA_META,
  ROADMAP_EASE_LEVELS,
  ROADMAP_IMPACT_LEVELS,
  type RoadmapStatus,
} from "@/lib/roadmap/types";
import type { CreateRoadmapJobInput } from "@/lib/roadmap/core";
import { JobIcon, ProjectIcon } from "./roadmapIcons";
import { PropertyPill, ScorePillDropdown } from "./roadmapPills";
import { MetaDropdown, ROADMAP_STATUS_META } from "./roadmapUi";

/** Where a new job can start. */
const START_STATUSES: RoadmapStatus[] = ["evaluate", "up_next", "todo", "in_progress"];

/**
 * New job, like Linear's New issue: a title, a description and Done when,
 * then the properties as pills. "Create more" keeps it open for the next one.
 */
export function NewJobComposer({
  areas,
  projects,
  defaultArea,
  defaultProject,
  lockedProject,
  onCreate,
  onClose,
}: {
  areas: string[];
  projects: string[];
  defaultArea: string;
  defaultProject: string | null;
  /** On a project's Jobs tab: the project is fixed. */
  lockedProject?: string;
  onCreate: (input: CreateRoadmapJobInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [doneWhen, setDoneWhen] = useState("");
  const [status, setStatus] = useState<RoadmapStatus>("todo");
  const [project, setProject] = useState<string | null>(lockedProject ?? defaultProject);
  const [area, setArea] = useState(defaultArea);
  const [impact, setImpact] = useState<number | null>(null);
  const [ease, setEase] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState(0);
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const create = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    const ok = await onCreate({
      title: title.trim(),
      notes: notes.trim() || null,
      doneWhen: doneWhen.trim() || null,
      status,
      project,
      area,
      impact,
      ease,
    });
    setSaving(false);
    if (!ok) {
      setError("That didn't save. Try again.");
      return;
    }
    if (!more) {
      onClose();
      return;
    }
    // Create more: keep the properties, clear the words, ready for the next one.
    setTitle("");
    setNotes("");
    setDoneWhen("");
    setMade((n) => n + 1);
    titleRef.current?.focus();
  };

  const statusMeta = ROADMAP_STATUS_META[status];
  const areaMeta = ROADMAP_AREA_META[area];

  return (
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label="New job">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
      <div className="absolute left-1/2 top-[12vh] w-[min(calc(100vw-1.5rem),44rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-0.5">
              <JobIcon className="h-3.5 w-3.5" aria-hidden />
              Jobs
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />
            <span className="font-medium text-slate-900">New job</span>
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-2 pt-4">
          <input
            ref={titleRef}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void create();
            }}
            placeholder="Job title"
            aria-label="Job title"
            className="w-full border-0 bg-transparent p-0 text-xl font-semibold tracking-tight text-slate-950 placeholder:text-slate-300 focus:outline-none focus:ring-0"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add a description…"
            aria-label="Description"
            className="mt-3 w-full resize-none border-0 bg-transparent p-0 text-ui leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />
          <input
            value={doneWhen}
            onChange={(e) => setDoneWhen(e.target.value)}
            placeholder="Done when: what finished looks like, in a sentence"
            aria-label="Done when"
            className="mt-1 w-full rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-700/60 focus:border-emerald-300 focus:outline-none"
          />

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <MetaDropdown
              bare
              display={
                <PropertyPill>
                  <span className={`h-2 w-2 rounded-full ${statusMeta.chip.split(" ")[0]}`} aria-hidden />
                  {status === "todo" ? "To do" : statusMeta.label}
                </PropertyPill>
              }
              options={START_STATUSES.map((s) => ({
                key: s,
                selected: status === s,
                onSelect: () => setStatus(s),
                node: (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROADMAP_STATUS_META[s].chip}`}>
                    {s === "todo" ? "To do" : ROADMAP_STATUS_META[s].label}
                  </span>
                ),
              }))}
            />
            {lockedProject ? (
              <PropertyPill>
                <ProjectIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                {lockedProject}
              </PropertyPill>
            ) : (
              <MetaDropdown
                bare
                display={
                  <PropertyPill muted={!project}>
                    <ProjectIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    {project ?? "Project"}
                  </PropertyPill>
                }
                options={projects.map((p) => ({
                  key: p,
                  selected: project === p,
                  onSelect: () => setProject(p),
                  node: <span className="truncate">{p}</span>,
                }))}
                onClear={project ? () => setProject(null) : undefined}
              />
            )}
            <MetaDropdown
              bare
              display={
                <PropertyPill>
                  {areaMeta ? <span className={`h-2 w-2 rounded-full ${areaMeta.dot}`} aria-hidden /> : <Tag className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
                  {areaMeta?.label ?? area}
                </PropertyPill>
              }
              options={areas.map((a) => ({
                key: a,
                selected: area === a,
                onSelect: () => setArea(a),
                node: (
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${ROADMAP_AREA_META[a]?.dot ?? "bg-slate-300"}`} aria-hidden />
                    {ROADMAP_AREA_META[a]?.label ?? a}
                  </span>
                ),
              }))}
            />
            <ScorePillDropdown label="Impact" icon={Zap} value={impact} names={ROADMAP_IMPACT_LEVELS} onChange={setImpact} />
            <ScorePillDropdown label="Ease" icon={Gauge} value={ease} names={ROADMAP_EASE_LEVELS} onChange={setEase} />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <p className="text-sm" aria-live="polite">
            {error ? <span className="font-medium text-rose-600">{error}</span> : made ? <span className="text-slate-500">Added {made}. Next one…</span> : null}
          </p>
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <span className="relative inline-flex">
                <input type="checkbox" checked={more} onChange={(e) => setMore(e.target.checked)} className="peer sr-only" />
                <span className="h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-[#0c5290]" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
              </span>
              Create more
            </label>
            <button type="button" disabled={!title.trim() || saving} onClick={() => void create()} className={buttonClass("main", "small")}>
              {saving ? "Adding…" : "Create job"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

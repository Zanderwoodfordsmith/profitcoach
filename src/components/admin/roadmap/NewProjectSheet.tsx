"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Gauge, X, Zap } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import {
  PROJECT_EASE_LEVELS,
  PROJECT_STAGE_META,
  PROJECT_STAGES,
  type ProjectStage,
} from "@/lib/roadmap/projectTypes";
import { ROADMAP_IMPACT_LEVELS } from "@/lib/roadmap/types";
import { ProjectIcon } from "./roadmapIcons";
import { PropertyPill, ScorePillDropdown } from "./roadmapPills";
import { STAGE_TONE, StagePill } from "./RoadmapProjectsView";
import { MetaDropdown } from "./roadmapUi";
import { projectHref, roadmapAuthHeaders } from "./useRoadmapData";

/**
 * New project, like Linear's: a big clean sheet. Name, a short summary, the
 * properties as pills, then an open space for the brief.
 */
export function NewProjectSheet({
  defaultInitiativeId = null,
  onClose,
}: {
  defaultInitiativeId?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [brief, setBrief] = useState("");
  const [stage, setStage] = useState<ProjectStage>("next");
  const [initiativeId] = useState<string | null>(defaultInitiativeId);
  const [impact, setImpact] = useState<number | null>(null);
  const [ease, setEase] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    const headers = await roadmapAuthHeaders();
    const res = headers
      ? await fetch("/api/admin/roadmap/projects", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: name.trim(),
            goal: goal.trim() || null,
            brief: brief.trim() ? brief : null,
            stage,
            initiative_id: initiativeId,
            ...(impact ? { impact } : {}),
            ...(ease ? { ease } : {}),
          }),
        }).catch(() => null)
      : null;
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    if (!res?.ok) {
      setError(body?.error ?? "That didn't save. Try again.");
      return;
    }
    router.push(projectHref(name.trim()));
  };

  return (
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label="New project">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
      <div className="absolute left-1/2 top-1/2 flex h-[min(88vh,820px)] w-[min(calc(100vw-1.5rem),56rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-0.5">
              <ProjectIcon className="h-3.5 w-3.5" aria-hidden />
              Projects
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />
            <span className="font-medium text-slate-900">New project</span>
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-6 pt-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600" aria-hidden>
            <ProjectIcon className="h-5 w-5" />
          </span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            aria-label="Project name"
            className="mt-4 w-full border-0 bg-transparent p-0 text-[2rem] font-semibold leading-tight tracking-tight text-slate-950 placeholder:text-slate-300 focus:outline-none focus:ring-0"
          />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Add a short summary…"
            aria-label="Summary"
            className="mt-2 w-full border-0 bg-transparent p-0 text-lg text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />

          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            <MetaDropdown
              bare
              display={
                <PropertyPill>
                  <span className={`h-2 w-2 rounded-full ${STAGE_TONE[stage].dot}`} aria-hidden />
                  {PROJECT_STAGE_META[stage].label}
                </PropertyPill>
              }
              options={PROJECT_STAGES.map((st) => ({
                key: st,
                selected: stage === st,
                onSelect: () => setStage(st),
                node: <StagePill stage={st} />,
              }))}
            />
            <ScorePillDropdown label="Impact" icon={Zap} value={impact} names={ROADMAP_IMPACT_LEVELS} onChange={setImpact} />
            <ScorePillDropdown label="Ease" icon={Gauge} value={ease} names={PROJECT_EASE_LEVELS} onChange={setEase} />
          </div>

          <div className="mt-6 border-t border-slate-200" role="presentation" />

          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Write a description, a project brief, or collect ideas…"
            aria-label="Description"
            className="mt-6 min-h-48 w-full flex-1 resize-none border-0 bg-transparent p-0 text-ui leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <p className="text-sm font-medium text-rose-600" aria-live="polite">
            {error}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className={buttonClass("quiet", "small")}>
              Cancel
            </button>
            <button type="button" disabled={!name.trim() || saving} onClick={() => void create()} className={buttonClass("main", "small")}>
              {saving ? "Creating…" : "Create project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

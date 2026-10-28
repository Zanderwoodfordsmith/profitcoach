"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { RoadmapInitiative, RoadmapOwner, RoadmapProject, RoadmapProjectUpdate } from "@/lib/roadmap/projectTypes";
import type { RoadmapJob } from "@/lib/roadmap/types";

/** Signed-in admin headers for the roadmap API, or null when signed out. */
export async function roadmapAuthHeaders(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
}

/** A project row with nothing saved yet (its name only appears on jobs). */
export function blankProject(name: string): RoadmapProject {
  return {
    name,
    stage: "next",
    goal: null,
    impact: null,
    ease: null,
    start_on: null,
    target_on: null,
    sort_order: 999,
    updated_at: "",
    initiative_id: null,
    brief: null,
  };
}

/** Jobs, projects and initiatives for the Initiatives and Projects pages, with saves that show at once. */
export function useRoadmapData() {
  const [jobs, setJobs] = useState<RoadmapJob[] | null>(null);
  const [projects, setProjects] = useState<RoadmapProject[] | null>(null);
  const [initiatives, setInitiatives] = useState<RoadmapInitiative[] | null>(null);
  const [owners, setOwners] = useState<RoadmapOwner[]>([]);
  /** Each project's latest update, by project name (for health). */
  const [latest, setLatest] = useState<Map<string, RoadmapProjectUpdate>>(() => new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await roadmapAuthHeaders();
      if (!headers || cancelled) return;
      const get = async <T,>(url: string): Promise<T | null> => {
        const res = await fetch(url, { headers }).catch(() => null);
        return res?.ok ? ((await res.json().catch(() => null)) as T | null) : null;
      };
      const [j, p, i, u] = await Promise.all([
        get<{ jobs: RoadmapJob[] }>("/api/admin/roadmap"),
        get<{ projects: RoadmapProject[] }>("/api/admin/roadmap/projects"),
        get<{ initiatives: RoadmapInitiative[]; owners: RoadmapOwner[] }>("/api/admin/roadmap/initiatives"),
        get<{ updates: RoadmapProjectUpdate[] }>("/api/admin/roadmap/projects/updates"),
      ]);
      if (cancelled) return;
      if (!j || !p || !i) setError("Could not load the roadmap. Refresh to try again.");
      setJobs(j?.jobs ?? []);
      setProjects(p?.projects ?? []);
      setInitiatives(i?.initiatives ?? []);
      setOwners(i?.owners ?? []);
      setLatest(new Map((u?.updates ?? []).map((x) => [x.project, x])));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProject = useCallback(async (name: string, patch: Partial<RoadmapProject>) => {
    setProjects((prev) => {
      const list = prev ?? [];
      return list.some((p) => p.name === name)
        ? list.map((p) => (p.name === name ? { ...p, ...patch } : p))
        : [...list, { ...blankProject(name), ...patch }];
    });
    const headers = await roadmapAuthHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/roadmap/projects", { method: "PATCH", headers, body: JSON.stringify({ name, ...patch }) }).catch(() => null);
    if (!res?.ok) setError("That change didn't save. Refresh and try again.");
  }, []);

  const saveInitiative = useCallback(async (id: string, patch: Partial<RoadmapInitiative>) => {
    setInitiatives((prev) => (prev ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const headers = await roadmapAuthHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/roadmap/initiatives", { method: "PATCH", headers, body: JSON.stringify({ id, ...patch }) }).catch(() => null);
    if (!res?.ok) setError("That change didn't save. Refresh and try again.");
  }, []);

  const addInitiative = useCallback(async (name: string, status?: RoadmapInitiative["status"]) => {
    const headers = await roadmapAuthHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/roadmap/initiatives", { method: "POST", headers, body: JSON.stringify({ name, status }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { initiative?: RoadmapInitiative } | null;
    if (!res?.ok || !body?.initiative) setError("Could not add the initiative.");
    else setInitiatives((prev) => [...(prev ?? []), body.initiative!]);
  }, []);

  /** A new update becomes the project's latest straight away. */
  const noteUpdate = useCallback((update: RoadmapProjectUpdate) => {
    setLatest((prev) => new Map(prev).set(update.project, update));
  }, []);

  return { jobs, projects, initiatives, owners, latest, error, saveProject, saveInitiative, addInitiative, noteUpdate };
}

/** A project's page, or one of its tabs (updates, jobs). */
export function projectHref(name: string, tab?: "updates" | "jobs"): string {
  return `/admin/roadmap/projects/${encodeURIComponent(name)}${tab ? `/${tab}` : ""}`;
}

/** An initiative's page, or one of its tabs (updates, projects). */
export function initiativeHref(id: string, tab?: "updates" | "projects"): string {
  return `/admin/roadmap/initiatives/${id}${tab ? `/${tab}` : ""}`;
}

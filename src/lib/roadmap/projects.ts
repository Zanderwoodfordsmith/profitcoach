import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { isProjectStage, type RoadmapProject } from "./projectTypes";

export { PROJECT_STAGE_META, PROJECT_STAGES, isProjectStage, type ProjectStage, type RoadmapProject } from "./projectTypes";

const COLUMNS = "name, stage, goal, impact, ease, start_on, target_on, sort_order, updated_at";

export async function listRoadmapProjects(): Promise<RoadmapProject[]> {
  const { data, error } = await supabaseAdmin.from("roadmap_projects").select(COLUMNS).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as RoadmapProject[];
}

export type ProjectPatch = Partial<Pick<RoadmapProject, "stage" | "goal" | "impact" | "ease" | "start_on" | "target_on" | "sort_order">>;

function score(v: unknown): number | null | undefined {
  if (v === null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined;
}

function day(v: unknown): string | null | undefined {
  if (v === null || v === "") return null;
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

/** Keeps only valid fields; a project row is created the first time it's saved. */
export function cleanProjectPatch(body: Record<string, unknown>): ProjectPatch {
  const out: ProjectPatch = {};
  if (isProjectStage(body.stage)) out.stage = body.stage;
  if (typeof body.goal === "string" || body.goal === null) out.goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 200) || null : null;
  for (const k of ["impact", "ease"] as const) {
    if (k in body) {
      const v = score(body[k]);
      if (v !== undefined) out[k] = v;
    }
  }
  for (const k of ["start_on", "target_on"] as const) {
    if (k in body) {
      const v = day(body[k]);
      if (v !== undefined) out[k] = v;
    }
  }
  if (Number.isInteger(body.sort_order)) out.sort_order = body.sort_order as number;
  return out;
}

export async function saveRoadmapProject(name: string, patch: ProjectPatch): Promise<RoadmapProject> {
  const { data, error } = await supabaseAdmin
    .from("roadmap_projects")
    .upsert({ name, ...patch, updated_at: new Date().toISOString() }, { onConflict: "name" })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as RoadmapProject;
}

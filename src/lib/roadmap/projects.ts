import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  INITIATIVE_COLORS,
  INITIATIVE_ICONS,
  isInitiativeStatus,
  isProjectHealth,
  isProjectStage,
  type RoadmapInitiative,
  type RoadmapOwner,
  type RoadmapProject,
  type RoadmapProjectUpdate,
} from "./projectTypes";

export { PROJECT_STAGE_META, PROJECT_STAGES, isProjectStage, type ProjectStage, type RoadmapInitiative, type RoadmapProject } from "./projectTypes";

const COLUMNS = "name, stage, goal, impact, ease, start_on, target_on, sort_order, updated_at, initiative_id, brief";

export async function listRoadmapProjects(): Promise<RoadmapProject[]> {
  const { data, error } = await supabaseAdmin.from("roadmap_projects").select(COLUMNS).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as RoadmapProject[];
}

export type ProjectPatch = Partial<Pick<RoadmapProject, "stage" | "goal" | "impact" | "ease" | "start_on" | "target_on" | "sort_order" | "initiative_id" | "brief">>;

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
  if (body.initiative_id === null || isUuid(body.initiative_id)) out.initiative_id = body.initiative_id as string | null;
  if (typeof body.brief === "string" || body.brief === null) out.brief = typeof body.brief === "string" ? body.brief.slice(0, 50_000) || null : null;
  return out;
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** A brand-new project (New project sheet). Refuses a name that's already a project or on a job. */
export async function createRoadmapProject(name: string, patch: ProjectPatch): Promise<RoadmapProject> {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error("Give the project a name.");
  const [{ data: row }, { data: job }] = await Promise.all([
    supabaseAdmin.from("roadmap_projects").select("name").eq("name", clean).maybeSingle(),
    supabaseAdmin.from("roadmap_jobs").select("id").eq("project", clean).limit(1).maybeSingle(),
  ]);
  if (row || job) throw new Error(`There's already a project called ${clean}.`);
  const { data, error } = await supabaseAdmin
    .from("roadmap_projects")
    .insert({ ...patch, name: clean })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as RoadmapProject;
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

const INITIATIVE_COLUMNS = "id, name, goal, sort_order, brief, status, target, owner_id, icon, color";

export async function listRoadmapInitiatives(): Promise<RoadmapInitiative[]> {
  const { data, error } = await supabaseAdmin.from("roadmap_initiatives").select(INITIATIVE_COLUMNS).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as RoadmapInitiative[];
}

/** New initiatives go to the bottom, in the status they were added from (Active by default). */
export async function createRoadmapInitiative(name: string, status?: unknown): Promise<RoadmapInitiative> {
  const { data: last } = await supabaseAdmin
    .from("roadmap_initiatives")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabaseAdmin
    .from("roadmap_initiatives")
    .insert({
      name: name.trim().slice(0, 80),
      sort_order: (last?.sort_order ?? 0) + 1,
      ...(isInitiativeStatus(status) ? { status } : {}),
    })
    .select(INITIATIVE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as RoadmapInitiative;
}

export async function saveRoadmapInitiative(
  id: string,
  body: Record<string, unknown>,
): Promise<RoadmapInitiative> {
  const patch: Partial<RoadmapInitiative> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  if (typeof body.goal === "string" || body.goal === null) patch.goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 200) || null : null;
  if (Number.isInteger(body.sort_order)) patch.sort_order = body.sort_order as number;
  if (typeof body.brief === "string" || body.brief === null) patch.brief = typeof body.brief === "string" ? body.brief.slice(0, 50_000) || null : null;
  if (isInitiativeStatus(body.status)) patch.status = body.status;
  if (body.target === null || (typeof body.target === "string" && /^\d{4}(-Q[1-4])?$/.test(body.target))) patch.target = body.target as string | null;
  if (body.owner_id === null || isUuid(body.owner_id)) patch.owner_id = body.owner_id as string | null;
  if ((INITIATIVE_ICONS as readonly unknown[]).includes(body.icon)) patch.icon = body.icon as string;
  if ((INITIATIVE_COLORS as readonly unknown[]).includes(body.color)) patch.color = body.color as string;
  const { data, error } = await supabaseAdmin
    .from("roadmap_initiatives")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(INITIATIVE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as RoadmapInitiative;
}

/** Admins, who can own an initiative. */
export async function listRoadmapOwners(): Promise<RoadmapOwner[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, first_name, avatar_url")
    .eq("role", "admin")
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: ((p.full_name as string | null) || (p.first_name as string | null) || "Admin").trim(),
    avatar_url: (p.avatar_url as string | null) ?? null,
  }));
}

const UPDATE_COLUMNS = "id, project, health, body, author_name, created_at";

/** The updates of one or more projects (an initiative's), newest first. */
export async function listProjectUpdates(projects: string[]): Promise<RoadmapProjectUpdate[]> {
  const { data, error } = await supabaseAdmin
    .from("roadmap_project_updates")
    .select(UPDATE_COLUMNS)
    .in("project", projects)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as RoadmapProjectUpdate[];
}

/** Every project's latest update, for the health dots. */
export async function latestProjectUpdates(): Promise<RoadmapProjectUpdate[]> {
  const { data, error } = await supabaseAdmin
    .from("roadmap_project_updates")
    .select(UPDATE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  return ((data ?? []) as RoadmapProjectUpdate[]).filter((u) => (seen.has(u.project) ? false : (seen.add(u.project), true)));
}

export async function addProjectUpdate(
  project: string,
  body: Record<string, unknown>,
  authorId: string,
): Promise<RoadmapProjectUpdate> {
  if (!isProjectHealth(body.health)) throw new Error("Pick on track, at risk or off track.");
  const { data: author } = await supabaseAdmin
    .from("profiles")
    .select("full_name, first_name")
    .eq("id", authorId)
    .maybeSingle();
  const { data, error } = await supabaseAdmin
    .from("roadmap_project_updates")
    .insert({
      project: project.slice(0, 200),
      health: body.health,
      body: typeof body.body === "string" ? body.body.trim().slice(0, 10_000) || null : null,
      author_id: authorId,
      author_name: author?.first_name || author?.full_name || null,
    })
    .select(UPDATE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as RoadmapProjectUpdate;
}

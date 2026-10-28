import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ROADMAP_STATUSES,
  ROADMAP_VISIBILITIES,
  parseRoadmapJobNumber,
  type RoadmapChecklistItem,
  type RoadmapComment,
  type RoadmapJob,
  type RoadmapJobImage,
  type RoadmapStatus,
  type RoadmapVisibility,
} from "@/lib/roadmap/types";
export {
  ROADMAP_AREAS,
  ROADMAP_AREA_META,
  ROADMAP_STATUSES,
  ROADMAP_VISIBILITIES,
  formatRoadmapJobNumber,
  parseRoadmapJobNumber,
  type RoadmapChecklistItem,
  type RoadmapComment,
  type RoadmapJob,
  type RoadmapJobImage,
  type RoadmapStatus,
  type RoadmapVisibility,
} from "@/lib/roadmap/types";

/**
 * Roadmap jobs — mutation cores.
 *
 * These functions are the single write/read path for roadmap jobs. Both the
 * admin API routes and the AI panel tools call them, so behaviour can never
 * drift between "the button" and "the AI".
 */

export const ROADMAP_IMAGES_BUCKET = "roadmap-images";

const JOB_COLUMNS =
  "id, job_number, title, notes, done_when, urgent, area, project, status, blocked_by, app_path, visibility, impact, ease, checklist, comments, images, sort_order, created_at, updated_at, agent_status, agent_branch, agent_session_url, agent_log, agent_head_sha, agent_applied_sha, agent_applied_at, agent_pull_error";

function sanitizeChecklist(value: unknown): RoadmapChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .slice(0, 100)
    .map((v) => ({
      id: typeof v.id === "string" ? v.id : crypto.randomUUID(),
      text: typeof v.text === "string" ? v.text.slice(0, 500) : "",
      done: v.done === true,
    }))
    .filter((v) => v.text.trim().length > 0);
}

function sanitizeCommentBase(v: Record<string, unknown>) {
  return {
    id: typeof v.id === "string" ? v.id : crypto.randomUUID(),
    text: typeof v.text === "string" ? v.text.slice(0, 4000) : "",
    author: typeof v.author === "string" ? v.author.slice(0, 120) : null,
    created_at:
      typeof v.created_at === "string" ? v.created_at : new Date().toISOString(),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";

function sanitizeComments(value: unknown): RoadmapComment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .slice(0, 200)
    .map((v) => ({
      ...sanitizeCommentBase(v),
      edited_at: typeof v.edited_at === "string" ? v.edited_at : null,
      replies: (Array.isArray(v.replies) ? v.replies : [])
        .filter(isRecord)
        .slice(0, 100)
        .map(sanitizeCommentBase)
        .filter((r) => r.text.trim().length > 0),
    }))
    .filter((v) => v.text.trim().length > 0);
}

function sanitizeImages(value: unknown): RoadmapJobImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .slice(0, 30)
    .map((v) => ({
      id: typeof v.id === "string" ? v.id : crypto.randomUUID(),
      path: typeof v.path === "string" ? v.path.slice(0, 500) : "",
      url: typeof v.url === "string" ? v.url.slice(0, 1000) : "",
      name: typeof v.name === "string" ? v.name.slice(0, 200) : "image",
      created_at:
        typeof v.created_at === "string"
          ? v.created_at
          : new Date().toISOString(),
    }))
    .filter((v) => v.path.length > 0 && v.url.length > 0);
}

/** A 1-5 score, or null to clear it. Anything else is undefined (ignored). */
function sanitizeScore(value: unknown): number | null | undefined {
  if (value === null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function isRoadmapStatus(v: unknown): v is RoadmapStatus {
  return (
    typeof v === "string" && (ROADMAP_STATUSES as readonly string[]).includes(v)
  );
}

export function isRoadmapVisibility(v: unknown): v is RoadmapVisibility {
  return (
    typeof v === "string" &&
    (ROADMAP_VISIBILITIES as readonly string[]).includes(v)
  );
}

export async function listRoadmapJobs(filter?: {
  area?: string | null;
  status?: RoadmapStatus | null;
}): Promise<RoadmapJob[]> {
  let q = supabaseAdmin
    .from("roadmap_jobs")
    .select(JOB_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (filter?.area) q = q.eq("area", filter.area);
  if (filter?.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw new Error(`listRoadmapJobs: ${error.message}`);
  return (data ?? []) as RoadmapJob[];
}

export async function getRoadmapJob(id: string): Promise<RoadmapJob | null> {
  const { data, error } = await supabaseAdmin
    .from("roadmap_jobs")
    .select(JOB_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getRoadmapJob: ${error.message}`);
  return (data as RoadmapJob | null) ?? null;
}

/** Resolves a job reference: its uuid, or its number ("BLD-0012", "12"). */
export async function resolveRoadmapJobId(ref: string): Promise<string | null> {
  const n = parseRoadmapJobNumber(ref);
  if (n === null) return ref.trim() || null;
  const { data, error } = await supabaseAdmin
    .from("roadmap_jobs")
    .select("id")
    .eq("job_number", n)
    .maybeSingle();
  if (error) throw new Error(`resolveRoadmapJobId: ${error.message}`);
  return (data?.id as string | undefined) ?? null;
}

export type CreateRoadmapJobInput = {
  title: string;
  notes?: string | null;
  doneWhen?: string | null;
  urgent?: boolean | null;
  area?: string | null;
  project?: string | null;
  status?: RoadmapStatus | null;
  blockedBy?: string | null;
  appPath?: string | null;
  visibility?: RoadmapVisibility | null;
  impact?: number | null;
  ease?: number | null;
  sortOrder?: number | null;
};

export async function createRoadmapJob(
  input: CreateRoadmapJobInput
): Promise<RoadmapJob> {
  const title = input.title?.trim();
  if (!title) throw new Error("createRoadmapJob: title is required.");
  const { data, error } = await supabaseAdmin
    .from("roadmap_jobs")
    .insert({
      title: title.slice(0, 300),
      notes: input.notes?.trim() || null,
      done_when: input.doneWhen?.trim().slice(0, 2000) || null,
      urgent: input.urgent === true,
      area: input.area?.trim() || "platform",
      project: input.project?.trim().slice(0, 80) || null,
      status: input.status && isRoadmapStatus(input.status) ? input.status : "todo",
      blocked_by: input.blockedBy?.trim() || null,
      app_path: input.appPath?.trim() || null,
      visibility:
        input.visibility && isRoadmapVisibility(input.visibility)
          ? input.visibility
          : "internal",
      impact: sanitizeScore(input.impact) ?? null,
      ease: sanitizeScore(input.ease) ?? null,
      ...(typeof input.sortOrder === "number" ? { sort_order: input.sortOrder } : {}),
    })
    .select(JOB_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`createRoadmapJob: ${error?.message ?? "insert failed"}`);
  }
  return data as RoadmapJob;
}

export type UpdateRoadmapJobInput = {
  title?: string;
  notes?: string | null;
  doneWhen?: string | null;
  urgent?: boolean;
  area?: string;
  project?: string | null;
  status?: RoadmapStatus;
  blockedBy?: string | null;
  appPath?: string | null;
  visibility?: RoadmapVisibility;
  impact?: number | null;
  ease?: number | null;
  sortOrder?: number;
  checklist?: RoadmapChecklistItem[];
  comments?: RoadmapComment[];
  images?: RoadmapJobImage[];
};

export async function updateRoadmapJob(
  id: string,
  patch: UpdateRoadmapJobInput
): Promise<RoadmapJob> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.title === "string" && patch.title.trim()) {
    update.title = patch.title.trim().slice(0, 300);
  }
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null;
  if (typeof patch.urgent === "boolean") update.urgent = patch.urgent;
  if (patch.doneWhen !== undefined) {
    update.done_when = patch.doneWhen?.trim().slice(0, 2000) || null;
  }
  if (typeof patch.area === "string" && patch.area.trim()) {
    update.area = patch.area.trim();
  }
  if (patch.project !== undefined) {
    update.project = patch.project?.trim().slice(0, 80) || null;
  }
  if (patch.status !== undefined) {
    if (!isRoadmapStatus(patch.status)) {
      throw new Error(`updateRoadmapJob: invalid status "${patch.status}".`);
    }
    update.status = patch.status;
  }
  if (patch.blockedBy !== undefined) {
    update.blocked_by = patch.blockedBy?.trim() || null;
  }
  if (patch.appPath !== undefined) {
    update.app_path = patch.appPath?.trim() || null;
  }
  if (patch.visibility !== undefined) {
    if (!isRoadmapVisibility(patch.visibility)) {
      throw new Error(
        `updateRoadmapJob: invalid visibility "${patch.visibility}".`
      );
    }
    update.visibility = patch.visibility;
  }
  if (patch.impact !== undefined) {
    const impact = sanitizeScore(patch.impact);
    if (impact !== undefined) update.impact = impact;
  }
  if (patch.ease !== undefined) {
    const ease = sanitizeScore(patch.ease);
    if (ease !== undefined) update.ease = ease;
  }
  if (typeof patch.sortOrder === "number") update.sort_order = patch.sortOrder;
  if (patch.checklist !== undefined) {
    update.checklist = sanitizeChecklist(patch.checklist);
  }
  if (patch.comments !== undefined) {
    update.comments = sanitizeComments(patch.comments);
  }
  if (patch.images !== undefined) {
    update.images = sanitizeImages(patch.images);
  }

  const { data, error } = await supabaseAdmin
    .from("roadmap_jobs")
    .update(update)
    .eq("id", id)
    .select(JOB_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`updateRoadmapJob: ${error?.message ?? "not found"}`);
  }
  return data as RoadmapJob;
}

export async function deleteRoadmapJob(id: string): Promise<void> {
  // Clean up stored images first so the bucket doesn't accumulate orphans.
  const job = await getRoadmapJob(id);
  const paths = (job?.images ?? []).map((i) => i.path).filter(Boolean);
  if (paths.length > 0) {
    await supabaseAdmin.storage.from(ROADMAP_IMAGES_BUCKET).remove(paths);
  }
  const { error } = await supabaseAdmin
    .from("roadmap_jobs")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`deleteRoadmapJob: ${error.message}`);
}

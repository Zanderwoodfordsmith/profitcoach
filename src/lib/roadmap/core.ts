import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Roadmap jobs — mutation cores.
 *
 * These functions are the single write/read path for roadmap jobs. Both the
 * admin API routes and the AI panel tools call them, so behaviour can never
 * drift between "the button" and "the AI".
 */

/**
 * Workflow order: todo -> up_next -> in_progress -> done -> live.
 * Parked = backlog/someday. "Blocked" is not a status — a job is blocked
 * when blocked_by is set, shown as a red flag on the card.
 */
export const ROADMAP_STATUSES = [
  "todo",
  "up_next",
  "in_progress",
  "done",
  "live",
  "parked",
] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export const ROADMAP_VISIBILITIES = ["internal", "members"] as const;
export type RoadmapVisibility = (typeof ROADMAP_VISIBILITIES)[number];

/** Suggested areas (free text in the DB; keep these as the working set). */
export const ROADMAP_AREAS = [
  "beat1",
  "beat2",
  "website",
  "ai-panel",
  "q4",
  "general",
] as const;

export type RoadmapChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type RoadmapComment = {
  id: string;
  text: string;
  author: string | null;
  created_at: string;
};

/** Reference image (design ref, screenshot) stored in the roadmap-images bucket. */
export type RoadmapJobImage = {
  id: string;
  /** Storage object path inside the bucket, e.g. "{jobId}/{uuid}.png". */
  path: string;
  /** Public URL — what the UI renders and a builder agent fetches. */
  url: string;
  name: string;
  created_at: string;
};

export const ROADMAP_IMAGES_BUCKET = "roadmap-images";

export type RoadmapJob = {
  id: string;
  title: string;
  notes: string | null;
  area: string;
  status: RoadmapStatus;
  blocked_by: string | null;
  app_path: string | null;
  visibility: RoadmapVisibility;
  checklist: RoadmapChecklistItem[];
  comments: RoadmapComment[];
  images: RoadmapJobImage[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const JOB_COLUMNS =
  "id, title, notes, area, status, blocked_by, app_path, visibility, checklist, comments, images, sort_order, created_at, updated_at";

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

function sanitizeComments(value: unknown): RoadmapComment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .slice(0, 200)
    .map((v) => ({
      id: typeof v.id === "string" ? v.id : crypto.randomUUID(),
      text: typeof v.text === "string" ? v.text.slice(0, 4000) : "",
      author: typeof v.author === "string" ? v.author.slice(0, 120) : null,
      created_at:
        typeof v.created_at === "string"
          ? v.created_at
          : new Date().toISOString(),
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

export type CreateRoadmapJobInput = {
  title: string;
  notes?: string | null;
  area?: string | null;
  status?: RoadmapStatus | null;
  blockedBy?: string | null;
  appPath?: string | null;
  visibility?: RoadmapVisibility | null;
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
      area: input.area?.trim() || "general",
      status: input.status && isRoadmapStatus(input.status) ? input.status : "todo",
      blocked_by: input.blockedBy?.trim() || null,
      app_path: input.appPath?.trim() || null,
      visibility:
        input.visibility && isRoadmapVisibility(input.visibility)
          ? input.visibility
          : "internal",
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
  area?: string;
  status?: RoadmapStatus;
  blockedBy?: string | null;
  appPath?: string | null;
  visibility?: RoadmapVisibility;
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
  if (typeof patch.area === "string" && patch.area.trim()) {
    update.area = patch.area.trim();
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

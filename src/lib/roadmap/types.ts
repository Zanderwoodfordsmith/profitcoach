/**
 * Roadmap constants and types, safe for the browser (database access stays in core.ts).
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
  "get-clients",
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

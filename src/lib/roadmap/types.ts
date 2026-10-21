/**
 * Roadmap constants and types, safe for the browser (database access stays in core.ts).
 */

/**
 * Workflow order: todo -> up_next -> in_progress -> review -> done -> live.
 * Review = built, waiting for Zander to check it; only he moves it on to
 * done. Done = checked and pushed (deployed, may still be admin-only).
 * Live = released to coaches. Ideas sit outside the flow: evaluate (new,
 * not scored or decided), parked (good one day, not now), vetoed (decided
 * against for now, kept as a log). "Blocked" is not a status — a job is blocked
 * when blocked_by is set, shown as a red flag on the card.
 */
export const ROADMAP_STATUSES = [
  "todo",
  "up_next",
  "in_progress",
  "review",
  "done",
  "live",
  "evaluate",
  "parked",
  "vetoed",
] as const;

export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export const ROADMAP_VISIBILITIES = ["internal", "members"] as const;

export type RoadmapVisibility = (typeof ROADMAP_VISIBILITIES)[number];

/**
 * Product categories, in coach-journey order (free text in the DB; keep these
 * as the working set). Most effort belongs in get-clients: lead volume is the
 * limiter, so anything that lifts reply, booking or close rates means a coach
 * needs fewer leads per client.
 */
export const ROADMAP_AREAS = [
  "set-up",
  "get-clients",
  "keep-clients",
  "platform",
] as const;

export const ROADMAP_AREA_META: Record<
  string,
  { label: string; hint: string; dot: string; chip: string }
> = {
  "set-up": {
    label: "Set up",
    hint: "Practice install: Blueprint, brand, website, profile, onboarding",
    dot: "bg-violet-500",
    chip: "bg-violet-100 text-violet-800",
  },
  "get-clients": {
    label: "Get clients",
    hint: "Leads, replies, bookings, closes",
    dot: "bg-sky-500",
    chip: "bg-sky-100 text-sky-800",
  },
  "keep-clients": {
    label: "Keep clients",
    hint: "Deliver for clients and keep them: packs, briefs, client tools",
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800",
  },
  platform: {
    label: "Platform",
    hint: "The app itself: Classroom, Ava plumbing, admin, fixes",
    dot: "bg-slate-400",
    chip: "bg-slate-200 text-slate-700",
  },
};

/** Impact and ease are scored 1 (low) to 5 (high). */
export const ROADMAP_SCORES = [1, 2, 3, 4, 5] as const;

/**
 * Impact: how much better this makes BCA. 5 = a big move on any one of
 * coach results (calls, clients), cash (sales, upgrades, keeping members),
 * member happiness, or Zander's time (less manual work, more automated).
 */
export const ROADMAP_IMPACT_HINT =
  "Coach results, cash, member happiness or less work for Zander";

/**
 * Ease: time until it's live, counting Zander's review and anyone else it
 * needs. 5 = one prompt, built and checked in under an hour. 4 = half a day.
 * 3 = a day or two. 2 = about a week. 1 = over a week, or waiting on others.
 */
export const ROADMAP_EASE_HINT =
  "5 under an hour · 4 half a day · 3 a day or two · 2 a week · 1 longer";

export const ROADMAP_EASE_LEVELS: Record<number, string> = {
  5: "Under an hour, one prompt",
  4: "Half a day",
  3: "A day or two",
  2: "About a week",
  1: "Over a week, or waiting on others",
};

/** Display form of a job number, e.g. 12 -> "#12" (support uses SUP-0410). */
export function formatRoadmapJobNumber(n: number): string {
  return `#${n}`;
}

/** Reads "#12", "BLD-0012", "BLD-12", "bld 12", "build 12" or "12" as 12. */
export function parseRoadmapJobNumber(ref: string): number | null {
  const m = ref.trim().match(/^(?:(?:bld|build|job)?[\s#-]*)?0*(\d{1,9})$/i);
  return m ? Number(m[1]) : null;
}

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
  job_number: number;
  title: string;
  notes: string | null;
  area: string;
  status: RoadmapStatus;
  blocked_by: string | null;
  app_path: string | null;
  visibility: RoadmapVisibility;
  /** Groups jobs under one piece of work, e.g. "Blueprint". Free text. */
  project: string | null;
  /** 1-5, null until scored. See ROADMAP_IMPACT_HINT. */
  impact: number | null;
  /** 1-5, null until scored. See ROADMAP_EASE_HINT. */
  ease: number | null;
  checklist: RoadmapChecklistItem[];
  comments: RoadmapComment[];
  images: RoadmapJobImage[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

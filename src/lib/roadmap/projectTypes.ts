/** A roadmap project's own fields (table roadmap_projects); its jobs are roadmap_jobs with project = name. */
export const PROJECT_STAGES = ["now", "next", "later", "parked"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_STAGE_META: Record<ProjectStage, { label: string; hint: string }> = {
  now: { label: "Now", hint: "Being built. Overnight work comes from here first." },
  next: { label: "Next", hint: "Up after Now. Small jobs here are fine." },
  later: { label: "Later", hint: "Worth doing, not yet." },
  parked: { label: "Parked", hint: "Far from launch. Pages kept out of the way (Tools and links)." },
};

export type RoadmapProject = {
  name: string;
  stage: ProjectStage;
  goal: string | null;
  impact: number | null;
  ease: number | null;
  /** Loose start and target, as YYYY-MM-DD (the timeline shows weeks). */
  start_on: string | null;
  target_on: string | null;
  sort_order: number;
  updated_at: string;
};

export function isProjectStage(v: unknown): v is ProjectStage {
  return typeof v === "string" && (PROJECT_STAGES as readonly string[]).includes(v);
}

/** Ease for a whole project: how soon all of it could be live (jobs use smaller steps). */
export const PROJECT_EASE_LEVELS: Record<number, string> = {
  5: "Days",
  4: "About a week",
  3: "2 to 3 weeks",
  2: "A month or two",
  1: "Longer",
};

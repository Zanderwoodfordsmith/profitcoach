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
  /** The initiative this project sits under (table roadmap_initiatives), if any. */
  initiative_id: string | null;
  /** The write-up on the project's own page (markdown). */
  brief: string | null;
};

/** Above projects, like Linear: initiatives, then projects, then jobs. */
export type RoadmapInitiative = {
  id: string;
  name: string;
  goal: string | null;
  sort_order: number;
  /** The write-up on the initiative's own page (markdown). */
  brief: string | null;
  status: InitiativeStatus;
  /** A quarter ("2026-Q4") or a year ("2027"). */
  target: string | null;
  /** The admin who owns it (profiles.id). */
  owner_id: string | null;
  /** One of INITIATIVE_ICONS, shown in a circle of one of INITIATIVE_COLORS. */
  icon: string | null;
  color: string | null;
};

/** Icons an initiative can have (lucide names); the picker shows them in this order. */
export const INITIATIVE_ICONS = [
  "rocket",
  "trending-up",
  "target",
  "sparkles",
  "heart",
  "users",
  "handshake",
  "briefcase",
  "graduation-cap",
  "megaphone",
  "globe",
  "compass",
  "flag",
  "shield",
  "wrench",
  "zap",
  "star",
  "layers",
] as const;

export const INITIATIVE_COLORS = ["sky", "violet", "emerald", "amber", "rose", "orange", "teal", "slate"] as const;

/** Like Linear: Planned (being shaped), Active (the dashboard), Completed. */
export const INITIATIVE_STATUSES = ["active", "planned", "completed"] as const;
export type InitiativeStatus = (typeof INITIATIVE_STATUSES)[number];
export const INITIATIVE_STATUS_LABEL: Record<InitiativeStatus, string> = {
  active: "Active",
  planned: "Planned",
  completed: "Completed",
};

export function isInitiativeStatus(v: unknown): v is InitiativeStatus {
  return typeof v === "string" && (INITIATIVE_STATUSES as readonly string[]).includes(v);
}

/** "2026-Q4" reads "Q4 2026"; a year reads as itself. */
export function targetLabel(target: string | null): string | null {
  if (!target) return null;
  const m = target.match(/^(\d{4})-(Q[1-4])$/);
  return m ? `${m[2]} ${m[1]}` : target;
}

/** Targets to pick from: this quarter and the next five, then this year and the next two. */
export function targetChoices(now = new Date()): string[] {
  const year = now.getFullYear();
  let q = Math.floor(now.getMonth() / 3) + 1;
  let y = year;
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    out.push(`${y}-Q${q}`);
    q += 1;
    if (q > 4) {
      q = 1;
      y += 1;
    }
  }
  return [...out, String(year), String(year + 1), String(year + 2)];
}

/** An admin who can own an initiative. */
export type RoadmapOwner = { id: string; name: string; avatar_url: string | null };

/** How a project is going, from its latest update; "missing" when there's been none for a week. */
export const PROJECT_HEALTHS = ["on_track", "at_risk", "off_track"] as const;
export type ProjectHealth = (typeof PROJECT_HEALTHS)[number];
export type ProjectHealthShown = ProjectHealth | "missing";
export const UPDATE_STALE_DAYS = 7;

export const PROJECT_HEALTH_META: Record<ProjectHealthShown, { label: string; dot: string; chip: string }> = {
  on_track: { label: "On track", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800" },
  at_risk: { label: "At risk", dot: "bg-amber-400", chip: "bg-amber-50 text-amber-800" },
  off_track: { label: "Off track", dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700" },
  missing: { label: "No update this week", dot: "bg-slate-300", chip: "bg-slate-100 text-slate-600" },
};

export function isProjectHealth(v: unknown): v is ProjectHealth {
  return typeof v === "string" && (PROJECT_HEALTHS as readonly string[]).includes(v);
}

export type RoadmapProjectUpdate = {
  id: string;
  project: string;
  health: ProjectHealth;
  body: string | null;
  author_name: string | null;
  created_at: string;
};

/** A project's health: its latest update, unless that's over a week old (or there isn't one). */
export function healthOf(latest: RoadmapProjectUpdate | undefined, now = Date.now()): ProjectHealthShown {
  if (!latest) return "missing";
  const age = now - Date.parse(latest.created_at);
  return age > UPDATE_STALE_DAYS * 86_400_000 ? "missing" : latest.health;
}

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

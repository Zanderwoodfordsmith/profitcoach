import type { RoadmapJob } from "@/lib/roadmap/types";

/**
 * Spaces (job 306): Profit Coach (the app), BCA and Client work. Until jobs
 * and projects carry their own space, it's guessed: BCA's website and funnel
 * work is BCA, Paul's site is client work, and the rest is the Profit Coach app.
 */
export const ROADMAP_SPACES = ["Profit Coach", "BCA", "Client work"] as const;
export type RoadmapSpace = (typeof ROADMAP_SPACES)[number];

export function projectSpace(name: string | null | undefined): RoadmapSpace {
  if (name === "BCA website and funnel") return "BCA";
  if (name === "Paul Swift website") return "Client work";
  return "Profit Coach";
}

export function jobSpace(job: Pick<RoadmapJob, "area" | "project">): RoadmapSpace {
  if (job.area === "bca-funnel") return "BCA";
  return projectSpace(job.project);
}

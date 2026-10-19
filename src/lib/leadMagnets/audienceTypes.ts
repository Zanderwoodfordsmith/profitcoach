/**
 * Lead magnet audience types and defaults, safe for the browser (audience queries stay in audience.ts).
 */

export const MAGNET_STAGES = ["opted_in", "started", "completed"] as const;

export type MagnetStage = (typeof MAGNET_STAGES)[number];

export type MagnetAudiencePerson = {
  id: string;
  full_name: string | null;
  email: string | null;
  business_name: string | null;
  stage: MagnetStage;
  /** Boss Score or Boss Pro total, when they have finished. */
  score: number | null;
  /** Question position on an in-progress Boss Score, 1–15. */
  progress_step: number | null;
  progress_total: number | null;
  at: string | null;
};

export type MagnetAudience = {
  unique_views: number;
  /** People who opted in during the window, including those who later started or finished. */
  opt_ins: number;
  stages: Record<MagnetStage, number>;
  /** Started plus completed — the completion-rate denominator. */
  started_total: number;
  people: MagnetAudiencePerson[];
};

export const EMPTY_STAGES: Record<MagnetStage, number> = {
  opted_in: 0,
  started: 0,
  completed: 0,
};


export function emptyMagnetAudience(): MagnetAudience {
  return {
    unique_views: 0,
    opt_ins: 0,
    stages: { ...EMPTY_STAGES },
    started_total: 0,
    people: [],
  };
}

export function later(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const aTime = Date.parse(a);
  const bTime = Date.parse(b);
  if (Number.isNaN(aTime)) return b;
  if (Number.isNaN(bTime)) return a;
  return aTime >= bTime ? a : b;
}

export const MAGNET_STAGE_LABEL: Record<MagnetStage, string> = {
  opted_in: "Opted in",
  started: "Started",
  completed: "Completed",
};

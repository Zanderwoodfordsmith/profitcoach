import type { ProspectNextCall } from "./prospectNextCall";
import type { ProspectNextAction } from "./actionPlans/prospectFollowUp";
import type { ProspectStatusDisplay } from "./prospectStatus";

export type BossScorePremiumSource = "diagnostic" | "coach_review";

export type ProspectRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  email: string | null;
  business_name: string | null;
  phone: string | null;
  type: string;
  prospect_status: string | null;
  status: ProspectStatusDisplay;
  coach_id?: string;
  coach_name?: string | null;
  coach_business_name?: string | null;
  /** Area scorecard (BOSS Score) — 0–100%. */
  boss_score: number | null;
  boss_score_at: string | null;
  boss_score_report_token: string | null;
  /** Full playbook grid (BOSS Score Premium) — 0–100. */
  boss_score_premium: number | null;
  boss_score_premium_at: string | null;
  boss_score_premium_source: BossScorePremiumSource | null;
  /** Most recent of boss_score_at and boss_score_premium_at — for status / filters. */
  last_assessed_at: string | null;
  revenue: string | null;
  team_size: string | null;
  years_in_business: string | null;
  outcome: string | null;
  obstacles: string | null;
  preferred_support: string | null;
  boss_level: string | null;
  next_call?: ProspectNextCall | null;
  next_action?: ProspectNextAction | null;
  crm_contact_id?: string | null;
  crm_location_id?: string | null;
  created_at?: string | null;
};

export function latestProspectAssessmentAt(
  bossScoreAt: string | null | undefined,
  premiumAt: string | null | undefined
): string | null {
  const dates = [bossScoreAt, premiumAt].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  if (dates.length === 0) return null;
  return dates.sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )[0];
}

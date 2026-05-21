import type { ProspectNextCall } from "./prospectNextCall";

export type ProspectRow = {
  id: string;
  full_name: string;
  email: string | null;
  business_name: string | null;
  phone: string | null;
  type: string;
  coach_id?: string;
  coach_name?: string | null;
  coach_business_name?: string | null;
  last_score: number | null;
  last_completed_at: string | null;
  revenue: string | null;
  team_size: string | null;
  years_in_business: string | null;
  outcome: string | null;
  obstacles: string | null;
  preferred_support: string | null;
  boss_level: string | null;
  next_call?: ProspectNextCall | null;
};

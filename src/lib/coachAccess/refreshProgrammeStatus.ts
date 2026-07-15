import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recompute programme / first_6_months from join date (DB function).
 * Safe to call often; no-op when the coach is locked, complimentary, or on Stripe.
 */
export async function refreshCoachProgrammeStatus(
  supabase: SupabaseClient,
  coachId?: string | null
): Promise<void> {
  const { error } = await supabase.rpc("refresh_coach_programme_status", {
    p_coach_id: coachId ?? null,
  });
  if (error) {
    console.error("refresh_coach_programme_status failed:", error.message);
  }
}

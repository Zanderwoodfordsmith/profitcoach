import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { AgentCoach } from "./types";

/** A coach the agent can act on: has a coaches row. Name from the profile. */
export async function loadAgentCoach(coachId: string): Promise<AgentCoach | null> {
  const [{ data: coach }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("coaches").select("id").eq("id", coachId).maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("full_name, coach_business_name")
      .eq("id", coachId)
      .maybeSingle(),
  ]);
  if (!coach) return null;
  const name =
    (profile?.full_name as string | null)?.trim() ||
    (profile?.coach_business_name as string | null)?.trim() ||
    "Unnamed coach";
  return { id: coachId, name };
}

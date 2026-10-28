import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { queryGroups } from "./terms";

/** Ava's name searches: coaches (admin) and one coach's people, ranked in Postgres. */

export type CoachMatch = {
  id: string;
  full_name: string | null;
  business: string | null;
  membership_status: string | null;
  agent_enabled: boolean;
  score: number;
};

export type PersonKind = "list_person" | "campaign_person" | "contact" | "conversation";

export type PersonMatch = {
  kind: PersonKind;
  id: string;
  name: string | null;
  company: string | null;
  title: string | null;
  /** The list or campaign they are on. */
  place: string | null;
  place_id: string | null;
  /** Campaign status, contact status, or a conversation's last message date. */
  status: string | null;
  score: number;
};

/** "every word" when all words matched, "close" when some did or nearly did. */
export function matchLabel(score: number): "every word" | "close" {
  return score >= 0.99 ? "every word" : "close";
}

export async function searchCoaches(query: string, limit = 8): Promise<CoachMatch[]> {
  const groups = queryGroups(query);
  if (!groups.length) return [];
  const { data, error } = await supabaseAdmin.rpc("ava_search_coaches", { p_groups: groups, p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoachMatch[];
}

export async function searchPeople(
  coachId: string,
  query: string,
  opts: { listId?: string; campaignId?: string; limit?: number } = {}
): Promise<PersonMatch[]> {
  const groups = queryGroups(query);
  if (!groups.length) return [];
  const { data, error } = await supabaseAdmin.rpc("ava_search_people", {
    p_coach_id: coachId,
    p_groups: groups,
    p_list_id: opts.listId ?? null,
    p_campaign_id: opts.campaignId ?? null,
    p_limit: opts.limit ?? 20,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as PersonMatch[];
}

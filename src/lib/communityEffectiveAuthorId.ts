import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Coach impersonation applies only on `/coach/*`. On `/admin/*` we always use the
 * signed-in account — sessionStorage may still hold a coach id from “view as coach”.
 */
export function coachPersonaForCommunity(
  pathname: string | null,
  impersonatingCoachId: string | null
): string | null {
  if (!impersonatingCoachId) return null;
  if (!pathname?.startsWith("/coach/")) return null;
  return impersonatingCoachId;
}

/** Community author id: coach persona when impersonating on coach routes, else auth user. */
export async function getCommunityAuthorId(
  coachPersonaId: string | null
): Promise<string | null> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) return null;
  return coachPersonaId ?? user.id;
}

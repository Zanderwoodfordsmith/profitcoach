import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Coach impersonation applies only on `/coach/*`. On `/admin/*` we always use the
 * signed-in account — sessionStorage may still hold a coach id from “view as coach”.
 */
export function coachPersonaForCommunity(
  pathname: string | null,
  impersonatingCoachId: string | null,
  /** When false, ignore stale sessionStorage impersonation (real coaches). */
  viewerIsAdmin: boolean | null = null
): string | null {
  if (!impersonatingCoachId) return null;
  if (!pathname?.startsWith("/coach/")) return null;
  // Only apply impersonation once we know the viewer is an admin. While role is
  // still loading (`null`), stale sessionStorage coach ids would otherwise key
  // read state and author ids to the wrong user for real coaches.
  if (viewerIsAdmin !== true) return null;
  return impersonatingCoachId;
}

/** localStorage key for feed read/dimmed state — never key off impersonation for coaches. */
export function communityFeedStorageScopeId(
  pathname: string | null,
  impersonatingCoachId: string | null,
  authUserId: string | null,
  viewerIsAdmin: boolean | null
): string | null {
  return (
    coachPersonaForCommunity(
      pathname,
      impersonatingCoachId,
      viewerIsAdmin
    ) ?? authUserId
  );
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

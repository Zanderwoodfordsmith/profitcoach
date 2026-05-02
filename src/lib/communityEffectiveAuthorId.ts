import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Who should appear as author for community posts/comments: impersonated coach when
 * admin is viewing as coach, otherwise the signed-in user.
 */
export async function getCommunityAuthorId(
  impersonatingCoachId: string | null
): Promise<string | null> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) return null;
  return impersonatingCoachId ?? user.id;
}

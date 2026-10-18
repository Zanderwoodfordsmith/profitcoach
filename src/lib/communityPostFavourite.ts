import { supabaseClient } from "@/lib/supabaseClient";
import { isUndefinedRelationError } from "@/lib/communitySupabaseErrors";
import { getSessionUser } from "@/lib/supabaseAccessToken";

/**
 * Toggles favourite (star). If `community_post_favourites` is missing, no-ops.
 */
export async function toggleCommunityPostFavourite(
  postId: string,
  currentlyFavourited: boolean
): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  if (currentlyFavourited) {
    const { error } = await supabaseClient
      .from("community_post_favourites")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) {
      if (isUndefinedRelationError(error)) return;
      throw error;
    }
    return;
  }

  const { error } = await supabaseClient
    .from("community_post_favourites")
    .insert({
      post_id: postId,
      user_id: user.id,
    });
  if (error) {
    if (isUndefinedRelationError(error)) return;
    throw error;
  }
}

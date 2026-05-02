import { supabaseClient } from "@/lib/supabaseClient";
import { isUndefinedRelationError } from "@/lib/communitySupabaseErrors";

/**
 * Toggles like. If `community_post_likes` is missing (migration not applied), no-ops.
 */
export async function toggleCommunityPostLike(
  postId: string,
  currentlyLiked: boolean
): Promise<void> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) return;

  if (currentlyLiked) {
    const { error } = await supabaseClient
      .from("community_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) {
      if (isUndefinedRelationError(error)) return;
      throw error;
    }
    return;
  }

  const { error } = await supabaseClient.from("community_post_likes").insert({
    post_id: postId,
    user_id: user.id,
  });
  if (error) {
    if (isUndefinedRelationError(error)) return;
    throw error;
  }
}

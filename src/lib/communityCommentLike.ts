import { supabaseClient } from "@/lib/supabaseClient";
import { isUndefinedRelationError } from "@/lib/communitySupabaseErrors";
import { getSessionUser } from "@/lib/supabaseAccessToken";

/**
 * Toggles like on a comment. If `community_comment_likes` is missing, no-ops.
 */
export async function toggleCommunityCommentLike(
  commentId: string,
  currentlyLiked: boolean
): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  if (currentlyLiked) {
    const { error } = await supabaseClient
      .from("community_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);
    if (error) {
      if (isUndefinedRelationError(error)) return;
      throw error;
    }
    return;
  }

  const { error } = await supabaseClient.from("community_comment_likes").insert({
    comment_id: commentId,
    user_id: user.id,
  });
  if (error) {
    if (isUndefinedRelationError(error)) return;
    throw error;
  }
}

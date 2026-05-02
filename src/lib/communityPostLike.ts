import { supabaseClient } from "@/lib/supabaseClient";

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
    if (error) throw error;
    return;
  }

  const { error } = await supabaseClient.from("community_post_likes").insert({
    post_id: postId,
    user_id: user.id,
  });
  if (error) throw error;
}

import { supabaseClient } from "@/lib/supabaseClient";

export async function setCommunityPostPinned(
  postId: string,
  pinned: boolean
): Promise<void> {
  const { error } = await supabaseClient
    .from("community_posts")
    .update({
      is_pinned: pinned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  if (error) throw error;
}

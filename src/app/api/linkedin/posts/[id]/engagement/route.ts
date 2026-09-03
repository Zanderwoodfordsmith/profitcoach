import { NextResponse } from "next/server";
import { requireContentPublisher } from "@/lib/linkedinAdminAuth";
import {
  getUnipilePost,
  listUnipilePostComments,
  listUnipilePostReactions,
} from "@/lib/unipile/client";
import { resolveUnipileAccountIdForUser } from "@/lib/unipile/publishing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Pull comments + reactions for a published Content post (Unipile).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireContentPublisher(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { data: post, error } = await supabaseAdmin
    .from("linkedin_scheduled_posts")
    .select(
      "id, user_id, content, status, linkedin_post_urn, published_at, engagement, engagement_synced_at"
    )
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error || !post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.status !== "published" || !post.linkedin_post_urn) {
    return NextResponse.json(
      { error: "Post is not published on LinkedIn yet." },
      { status: 400 }
    );
  }

  const accountId = await resolveUnipileAccountIdForUser(auth.userId);
  if (!accountId) {
    return NextResponse.json(
      { error: "Connect LinkedIn in Campaigns first." },
      { status: 400 }
    );
  }

  const postId = post.linkedin_post_urn as string;
  const detail = await getUnipilePost(postId, accountId);
  const socialId =
    (detail.data?.social_id as string | undefined) ||
    (detail.data?.id as string | undefined) ||
    postId;

  const [comments, reactions] = await Promise.all([
    listUnipilePostComments({
      post_id: postId,
      account_id: accountId,
      limit: 50,
    }),
    listUnipilePostReactions({
      post_id: socialId,
      account_id: accountId,
      limit: 50,
    }),
  ]);

  const commentItems = comments.ok ? comments.data?.items ?? [] : [];
  const reactionItems = reactions.ok ? reactions.data?.items ?? [] : [];
  const engagement = {
    comments: commentItems.length,
    reactions: reactionItems.length,
    comment_preview: commentItems.slice(0, 10).map((c) => ({
      id: c.id ?? c.comment_id,
      text: c.text ?? c.message ?? c.body,
      author:
        (c.author as { name?: string } | undefined)?.name ||
        c.author_name ||
        null,
    })),
    reaction_types: reactionItems.reduce<Record<string, number>>((acc, r) => {
      const t = String(r.reaction_type || r.type || "like");
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {}),
    errors: [
      !comments.ok ? comments.error : null,
      !reactions.ok ? reactions.error : null,
      !detail.ok ? detail.error : null,
    ].filter(Boolean),
  };

  await supabaseAdmin
    .from("linkedin_scheduled_posts")
    .update({
      engagement,
      engagement_synced_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    post_id: postId,
    social_id: socialId,
    engagement,
    synced_at: new Date().toISOString(),
  });
}

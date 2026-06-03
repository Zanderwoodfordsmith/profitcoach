import { NextResponse } from "next/server";
import { displayNameFromProfile } from "@/lib/communityProfile";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileEmbed = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

type CommentRowRaw = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  author: ProfileEmbed | ProfileEmbed[] | null;
};

async function requireStaff(request: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; message: string }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { ok: false, status: 401, message: "Missing access token." };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { ok: false, status: 401, message: "Invalid access token." };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;
  if (role !== "coach" && role !== "admin") {
    return { ok: false, status: 403, message: "Staff only." };
  }

  return { ok: true, userId: user.id };
}

function normalizeAuthor(
  author: ProfileEmbed | ProfileEmbed[] | null
): ProfileEmbed | null {
  if (!author) return null;
  return Array.isArray(author) ? author[0] ?? null : author;
}

async function loadLikeStats(
  commentIds: string[],
  viewerId: string
): Promise<Map<string, { like_count: number; liked_by_me: boolean }>> {
  const out = new Map<string, { like_count: number; liked_by_me: boolean }>();
  if (commentIds.length === 0) return out;

  const { data, error } = await supabaseAdmin.rpc(
    "community_post_comment_like_stats",
    {
      p_comment_ids: commentIds,
      p_viewer_id: viewerId,
    }
  );

  if (error) {
    const { data: likeRows } = await supabaseAdmin
      .from("community_comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds);

    for (const id of commentIds) {
      out.set(id, { like_count: 0, liked_by_me: false });
    }
    for (const row of likeRows ?? []) {
      const id = row.comment_id as string;
      const cur = out.get(id) ?? { like_count: 0, liked_by_me: false };
      cur.like_count += 1;
      if (row.user_id === viewerId) cur.liked_by_me = true;
      out.set(id, cur);
    }
    return out;
  }

  for (const row of (data ?? []) as {
    comment_id: string;
    like_count: number;
    liked_by_viewer: boolean;
  }[]) {
    out.set(row.comment_id, {
      like_count: row.like_count ?? 0,
      liked_by_me: Boolean(row.liked_by_viewer),
    });
  }
  return out;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const auth = await requireStaff(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status }
    );
  }

  const { postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: "Missing post id." }, { status: 400 });
  }

  const [commentsRes, postRes] = await Promise.all([
    supabaseAdmin
      .from("community_post_comments")
      .select(
        `
        id,
        post_id,
        author_id,
        body,
        created_at,
        parent_comment_id,
        author:profiles!author_id (
          id,
          full_name,
          first_name,
          last_name,
          avatar_url,
          role
        )
      `
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("community_posts")
      .select(
        `
        author:profiles!author_id (
          id,
          full_name,
          first_name,
          last_name,
          avatar_url,
          role
        )
      `
      )
      .eq("id", postId)
      .maybeSingle(),
  ]);

  if (commentsRes.error) {
    return NextResponse.json(
      { error: "Could not load comments." },
      { status: 500 }
    );
  }

  const rows = (commentsRes.data ?? []) as CommentRowRaw[];
  const postAuthor = normalizeAuthor(
    (postRes.data as { author?: ProfileEmbed | ProfileEmbed[] | null } | null)
      ?.author ?? null
  );
  const commentIds = rows.map((r) => r.id);
  const likeStats = await loadLikeStats(commentIds, auth.userId);

  const comments = rows.map((row) => {
    const author = normalizeAuthor(row.author);
    const stats = likeStats.get(row.id) ?? {
      like_count: 0,
      liked_by_me: false,
    };
    return {
      id: row.id,
      post_id: row.post_id,
      author_id: row.author_id,
      body: row.body,
      created_at: row.created_at,
      parent_comment_id: row.parent_comment_id,
      author: author
        ? {
            ...author,
            full_name:
              author.full_name?.trim() ||
              displayNameFromProfile(author),
          }
        : null,
      like_count: stats.like_count,
      liked_by_me: stats.liked_by_me,
    };
  });

  return NextResponse.json(
    {
      comments,
      post_author: postAuthor
        ? {
            ...postAuthor,
            full_name:
              postAuthor.full_name?.trim() ||
              displayNameFromProfile(postAuthor),
          }
        : null,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

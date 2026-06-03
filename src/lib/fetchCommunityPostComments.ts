import type { ProfileRow } from "@/components/community/CommunityFeed";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

export type CommunityPostCommentDto = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  author: ProfileRow | null;
  like_count: number;
  liked_by_me: boolean;
};

const CACHE_TTL_MS = 30_000;

export type CommunityPostCommentsPayload = {
  comments: CommunityPostCommentDto[];
  post_author: ProfileRow | null;
};

const cache = new Map<
  string,
  { fetchedAt: number; payload: CommunityPostCommentsPayload }
>();

export function invalidateCommunityPostCommentsCache(postId: string): void {
  cache.delete(postId);
}

export function getCachedCommunityPostComments(
  postId: string
): CommunityPostCommentsPayload | null {
  return readCache(postId);
}

function readCache(postId: string): CommunityPostCommentsPayload | null {
  const hit = cache.get(postId);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > CACHE_TTL_MS) {
    cache.delete(postId);
    return null;
  }
  return hit.payload;
}

export async function fetchCommunityPostComments(
  postId: string,
  options?: { skipCache?: boolean }
): Promise<CommunityPostCommentsPayload> {
  const empty = { comments: [], post_author: null };
  if (!options?.skipCache) {
    const cached = readCache(postId);
    if (cached) return cached;
  }

  const token = await getValidSupabaseAccessToken();
  if (!token) return empty;

  const res = await fetch(`/api/community/posts/${postId}/comments`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load comments (${res.status})`);
  }

  const json = (await res.json()) as {
    comments?: CommunityPostCommentDto[];
    post_author?: ProfileRow | null;
  };
  const payload: CommunityPostCommentsPayload = {
    comments: json.comments ?? [],
    post_author: json.post_author ?? null,
  };
  cache.set(postId, { fetchedAt: Date.now(), payload });
  return payload;
}

/** Warm comment thread while the post detail view is opening. */
export function prefetchCommunityPostComments(postId: string): void {
  if (readCache(postId)) return;
  void fetchCommunityPostComments(postId);
}

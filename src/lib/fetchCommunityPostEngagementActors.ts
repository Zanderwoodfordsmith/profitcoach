import type { ProfileRow } from "@/components/community/CommunityFeed";
import { supabaseClient } from "@/lib/supabaseClient";
import { isUndefinedRelationError } from "@/lib/communitySupabaseErrors";

type ProfileJoin = ProfileRow | ProfileRow[] | null;

function normalizeProfile(
  id: string,
  profile: ProfileJoin
): ProfileRow | null {
  const p = Array.isArray(profile) ? profile[0] ?? null : profile;
  if (!p) return { id };
  return { ...p, id: p.id ?? id };
}

function dedupeProfilesById(
  rows: { id: string; profile: ProfileRow | null }[]
): ProfileRow[] {
  const out: ProfileRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    if (row.profile) out.push(row.profile);
  }
  return out;
}

export async function fetchCommunityPostLikers(
  postId: string
): Promise<ProfileRow[]> {
  const { data, error } = await supabaseClient
    .from("community_post_likes")
    .select(
      `
      user_id,
      created_at,
      profile:profiles!user_id ( id, full_name, first_name, last_name, avatar_url, role )
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isUndefinedRelationError(error)) return [];
    throw error;
  }

  const rows = (data ?? []) as Array<{
    user_id: string;
    profile: ProfileJoin;
  }>;

  return dedupeProfilesById(
    rows.map((r) => ({
      id: r.user_id,
      profile: normalizeProfile(r.user_id, r.profile),
    }))
  );
}

export async function fetchCommunityPostCommenters(
  postId: string
): Promise<ProfileRow[]> {
  const { data, error } = await supabaseClient
    .from("community_post_comments")
    .select(
      `
      author_id,
      created_at,
      author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    author_id: string;
    author: ProfileJoin;
  }>;

  return dedupeProfilesById(
    rows.map((r) => ({
      id: r.author_id,
      profile: normalizeProfile(r.author_id, r.author),
    }))
  );
}

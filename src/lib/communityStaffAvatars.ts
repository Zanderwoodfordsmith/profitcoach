import type { ProfileRow } from "@/components/community/CommunityFeed";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";

export async function fetchStaffAvatarMap(
  userIds: string[],
  accessToken: string | null | undefined
): Promise<Record<string, string | null>> {
  if (userIds.length === 0) return {};
  const unique = [...new Set(userIds)];

  let token =
    (await getValidSupabaseAccessToken()) ?? accessToken ?? null;
  if (!token) return {};

  const post = (jwt: string) =>
    fetch("/api/community/staff-avatars", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ userIds: unique }),
    });

  let res = await post(token);
  if (res.status === 401) {
    await supabaseClient.auth.refreshSession();
    token = (await getValidSupabaseAccessToken()) ?? accessToken ?? null;
    if (!token) return {};
    res = await post(token);
  }

  if (!res.ok) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Community] staff-avatars API failed:",
        res.status,
        await res.clone().text().catch(() => "")
      );
    }
    return {};
  }
  const body = (await res.json()) as { avatars?: Record<string, string | null> };
  return body.avatars ?? {};
}

/**
 * Apply server-fetched avatar URLs. If the API returns null but the embed still
 * has a URL from the query, keep the embed value so we never drop a good URL
 * when the map was filled with nulls from the service read.
 */
export function mergeAuthorAvatar<P extends ProfileRow | null>(
  authorId: string,
  author: P,
  map: Record<string, string | null>
): P {
  if (!author || !(authorId in map)) return author;
  const fromApi = map[authorId];
  return {
    ...author,
    avatar_url: (fromApi ?? author.avatar_url) ?? null,
  };
}

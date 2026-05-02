import type { ProfileRow } from "@/components/community/CommunityFeed";

export async function fetchStaffAvatarMap(
  userIds: string[],
  accessToken: string | null | undefined
): Promise<Record<string, string | null>> {
  if (!accessToken || userIds.length === 0) return {};
  const unique = [...new Set(userIds)];
  const res = await fetch("/api/community/staff-avatars", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ userIds: unique }),
  });
  if (!res.ok) return {};
  const body = (await res.json()) as { avatars?: Record<string, string | null> };
  return body.avatars ?? {};
}

/** Apply server-fetched avatar URLs (same DB field as coach settings). */
export function mergeAuthorAvatar<P extends ProfileRow | null>(
  authorId: string,
  author: P,
  map: Record<string, string | null>
): P {
  if (!author || !(authorId in map)) return author;
  const next = map[authorId];
  return {
    ...author,
    avatar_url: next !== undefined ? next : author.avatar_url ?? null,
  };
}

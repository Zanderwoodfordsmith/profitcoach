import type { ProfileRow } from "@/components/community/CommunityFeed";

export type CommentAuthorRow = {
  post_id: string;
  author_id: string;
  created_at: string;
  author: ProfileRow | null;
};

function normalizeAuthor(row: CommentAuthorRow): ProfileRow | null {
  const a = row.author;
  if (!a) return null;
  const id = a.id ?? row.author_id;
  if (!id) return null;
  return {
    id,
    full_name: a.full_name,
    first_name: a.first_name,
    last_name: a.last_name,
    avatar_url: a.avatar_url,
  };
}

/**
 * Up to 5 avatars: first commenter, second (by first appearance), then up to three
 * most recent distinct commenters (newest first), de-duplicated.
 */
export function buildCommentPreviewAvatars(
  commentsForPost: CommentAuthorRow[],
  max = 5
): ProfileRow[] {
  const sorted = [...commentsForPost].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const firstOrder: string[] = [];
  const seenFirst = new Set<string>();
  for (const c of sorted) {
    if (!seenFirst.has(c.author_id)) {
      seenFirst.add(c.author_id);
      firstOrder.push(c.author_id);
    }
  }

  const recentOrder: string[] = [];
  const seenRecent = new Set<string>();
  for (let i = sorted.length - 1; i >= 0; i--) {
    const id = sorted[i].author_id;
    if (!seenRecent.has(id)) {
      seenRecent.add(id);
      recentOrder.push(id);
    }
  }

  const profileById = new Map<string, ProfileRow>();
  for (const c of sorted) {
    const p = normalizeAuthor(c);
    if (p) profileById.set(c.author_id, p);
  }

  const out: ProfileRow[] = [];
  const seen = new Set<string>();

  const push = (id: string | undefined) => {
    if (!id || out.length >= max || seen.has(id)) return;
    const p = profileById.get(id);
    if (p) {
      seen.add(id);
      out.push(p);
    }
  };

  push(firstOrder[0]);
  push(firstOrder[1]);
  for (const id of recentOrder) {
    if (out.length >= max) break;
    push(id);
  }

  return out;
}

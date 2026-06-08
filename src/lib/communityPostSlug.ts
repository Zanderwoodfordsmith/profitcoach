import { supabaseClient } from "@/lib/supabaseClient";

/** Static community routes that must not be treated as post slugs. */
export const RESERVED_COMMUNITY_PATH_SEGMENTS = new Set([
  "calendar",
  "ladder",
  "members",
  "feedback",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCommunityPostUuidParam(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Kebab-case slug from a post title, e.g. "Introduce Yourself! (Start Here🔥)" → "introduce-yourself-start-here". */
export function communityPostSlugFromTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "post";
}

export function communityPostPath(
  communityBaseHref: string,
  post: { title: string }
): string {
  const base = communityBaseHref.replace(/\/$/, "");
  return `${base}/${communityPostSlugFromTitle(post.title)}`;
}

export function communityPostSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/(?:coach|admin)\/community\/([^/?#]+)\/?$/);
  const segment = match?.[1] ?? null;
  if (!segment) return null;
  const decoded = decodeURIComponent(segment).trim().toLowerCase();
  if (!decoded || RESERVED_COMMUNITY_PATH_SEGMENTS.has(decoded)) return null;
  return decoded;
}

export function findCommunityPostIdBySlug(
  posts: { id: string; title: string }[],
  slug: string
): string | null {
  const target = slug.trim().toLowerCase();
  if (!target) return null;
  const matches = posts.filter(
    (p) => communityPostSlugFromTitle(p.title) === target
  );
  return matches[0]?.id ?? null;
}

/** Resolve a title slug when the post is not already in the loaded feed. */
export async function fetchCommunityPostIdBySlug(
  slug: string
): Promise<string | null> {
  const target = slug.trim().toLowerCase();
  if (!target) return null;

  const { data, error } = await supabaseClient
    .from("community_posts")
    .select("id, title")
    .order("created_at", { ascending: false });

  if (error || !data) return null;
  return findCommunityPostIdBySlug(data, target);
}

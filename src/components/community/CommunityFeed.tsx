"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { CreatePostModal } from "@/components/community/CreatePostModal";
import { PostDetailModal } from "@/components/community/PostDetailModal";
import { PostCard } from "@/components/community/PostCard";
import {
  communityAccessHint,
  supabaseErrorMessage,
} from "@/lib/supabaseErrorMessage";
import {
  buildCommentPreviewAvatars,
  type CommentAuthorRow,
} from "@/lib/communityCommentPreviewAvatars";
import { isUndefinedRelationError } from "@/lib/communitySupabaseErrors";
import {
  fetchStaffAvatarMap,
  mergeAuthorAvatar,
} from "@/lib/communityStaffAvatars";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { coachPersonaForCommunity } from "@/lib/communityEffectiveAuthorId";
import { PageHeaderUnderlineTabs, StickyPageHeader } from "@/components/layout";
import { CommunityMembersMap } from "@/components/community/CommunityMembersMap";

/** Direct profiles read when staff-avatars/embed left avatar_url empty (token/API gaps). */
async function fetchAvatarUrlsFromProfiles(
  ids: string[]
): Promise<Record<string, string | null>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, avatar_url")
    .in("id", ids);
  if (error || !data?.length) return {};
  const out: Record<string, string | null> = {};
  for (const r of data as { id: string; avatar_url: string | null }[]) {
    out[r.id] = r.avatar_url ?? null;
  }
  return out;
}

function applyAvatarFallback<P extends ProfileRow | null>(
  author: P,
  authorId: string,
  fb: Record<string, string | null>
): P {
  const url = fb[authorId];
  if (!url) return author;
  if (!author) return { id: authorId, avatar_url: url } as P;
  return { ...author, avatar_url: url };
}

export type ProfileRow = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
};

export type CommunityCategory = {
  id: string;
  slug: string;
  label: string;
};

export type CommunityPostRow = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  category_id: string;
  category: CommunityCategory | null;
  author: ProfileRow | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  comment_preview_authors: ProfileRow[];
};

export function CommunityFeed() {
  const { impersonatingCoachId } = useImpersonation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const communityTab =
    searchParams.get("tab") === "map" ? "map" : "feed";

  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [filterSlug, setFilterSlug] = useState<string | "all">("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [composeAvatarUrl, setComposeAvatarUrl] = useState<string | null>(null);

  const closeDetail = useCallback(() => {
    setSelectedPostId(null);
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("post");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openDetail = useCallback(
    (id: string) => {
      setSelectedPostId(id);
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("post", id);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const q = searchParams.get("post");
    if (q && /^[0-9a-f-]{36}$/i.test(q)) {
      setSelectedPostId(q);
    } else {
      setSelectedPostId(null);
    }
  }, [searchParams]);

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("community_categories")
      .select("id, slug, label")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    setCategories((data ?? []) as CommunityCategory[]);
  }, []);

  const loadPosts = useCallback(async () => {
    /* Explicit FK hints avoid PostgREST “could not find relationship” when inference fails. */
    const { data, error } = await supabaseClient
      .from("community_posts")
      .select(
        `
        id,
        title,
        body,
        image_url,
        is_pinned,
        created_at,
        category_id,
        category:community_categories!category_id ( id, slug, label ),
        author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url )
      `
      )
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    const rows = (data ?? []) as Array<
      Omit<
        CommunityPostRow,
        | "category"
        | "author"
        | "like_count"
        | "comment_count"
        | "liked_by_me"
        | "comment_preview_authors"
      > & {
        category: CommunityCategory | CommunityCategory[] | null;
        author: ProfileRow | ProfileRow[] | null;
      }
    >;
    const normalized = rows.map((row) => ({
      ...row,
      category: Array.isArray(row.category)
        ? row.category[0] ?? null
        : row.category ?? null,
      author: Array.isArray(row.author)
        ? row.author[0] ?? null
        : row.author ?? null,
    }));

    const postIds = normalized.map((p) => p.id);
    const emptyEngagement = {
      like_count: 0,
      comment_count: 0,
      liked_by_me: false,
      comment_preview_authors: [] as ProfileRow[],
    };

    if (postIds.length === 0) {
      setPosts(
        normalized.map((row) => ({
          ...row,
          ...emptyEngagement,
        }))
      );
      return;
    }

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    const uid = user?.id;

    const [likesRes, commentsRes] = await Promise.all([
      supabaseClient
        .from("community_post_likes")
        .select("post_id, user_id")
        .in("post_id", postIds),
      supabaseClient
        .from("community_post_comments")
        .select(
          `
          post_id,
          author_id,
          created_at,
          author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url )
        `
        )
        .in("post_id", postIds)
        .order("created_at", { ascending: true }),
    ]);

    if (likesRes.error && !isUndefinedRelationError(likesRes.error)) {
      throw likesRes.error;
    }
    if (commentsRes.error) throw commentsRes.error;

    const likesTableMissing = Boolean(
      likesRes.error && isUndefinedRelationError(likesRes.error)
    );
    if (likesTableMissing && process.env.NODE_ENV === "development") {
      console.warn(
        "[Community] community_post_likes query failed (table missing?). Run migration 20260508120000_community_post_likes.sql. Likes will show as 0 until then."
      );
    }

    let myLiked = new Set<string>();
    if (uid && !likesTableMissing) {
      const myRes = await supabaseClient
        .from("community_post_likes")
        .select("post_id")
        .eq("user_id", uid)
        .in("post_id", postIds);
      if (myRes.error && !isUndefinedRelationError(myRes.error)) {
        throw myRes.error;
      }
      if (!myRes.error) {
        myLiked = new Set(
          (myRes.data ?? []).map((r: { post_id: string }) => r.post_id)
        );
      }
    }

    const likeRows = (likesTableMissing ? [] : likesRes.data ?? []) as {
      post_id: string;
      user_id: string;
    }[];
    const likeCountByPost = new Map<string, number>();
    for (const r of likeRows) {
      likeCountByPost.set(r.post_id, (likeCountByPost.get(r.post_id) ?? 0) + 1);
    }

    const rawComments = (commentsRes.data ?? []) as Array<
      Omit<CommentAuthorRow, "author"> & {
        author: ProfileRow | ProfileRow[] | null;
      }
    >;
    const commentsNormalized: CommentAuthorRow[] = rawComments.map((row) => ({
      post_id: row.post_id,
      author_id: row.author_id,
      created_at: row.created_at,
      author: Array.isArray(row.author)
        ? row.author[0] ?? null
        : row.author ?? null,
    }));

    const avatarToken = await getValidSupabaseAccessToken();
    const avatarUserIds = [
      ...new Set([
        ...normalized.flatMap((p) => (p.author?.id ? [p.author.id] : [])),
        ...commentsNormalized.map((c) => c.author_id),
      ]),
    ];
    const avatarMap = await fetchStaffAvatarMap(avatarUserIds, avatarToken);

    let normalizedWithAvatars = normalized.map((row) => ({
      ...row,
      author: row.author?.id
        ? mergeAuthorAvatar(row.author.id, row.author, avatarMap)
        : row.author,
    }));

    let commentsWithAvatars: CommentAuthorRow[] = commentsNormalized.map(
      (c) => ({
        ...c,
        author: mergeAuthorAvatar(c.author_id, c.author, avatarMap),
      })
    );

    const stillMissing = new Set<string>();
    for (const row of normalizedWithAvatars) {
      if (row.author?.id && !row.author.avatar_url) {
        stillMissing.add(row.author.id);
      }
    }
    for (const c of commentsWithAvatars) {
      if (c.author_id && !c.author?.avatar_url) {
        stillMissing.add(c.author_id);
      }
    }
    if (stillMissing.size > 0) {
      const fb = await fetchAvatarUrlsFromProfiles([...stillMissing]);
      normalizedWithAvatars = normalizedWithAvatars.map((row) => ({
        ...row,
        author: row.author?.id
          ? applyAvatarFallback(row.author, row.author.id, fb)
          : row.author,
      }));
      commentsWithAvatars = commentsWithAvatars.map((c) => ({
        ...c,
        author: applyAvatarFallback(c.author, c.author_id, fb),
      }));
    }

    const commentsByPost = new Map<string, CommentAuthorRow[]>();
    for (const c of commentsWithAvatars) {
      const arr = commentsByPost.get(c.post_id) ?? [];
      arr.push(c);
      commentsByPost.set(c.post_id, arr);
    }

    setPosts(
      normalizedWithAvatars.map((row) => ({
        ...row,
        like_count: likeCountByPost.get(row.id) ?? 0,
        comment_count: (commentsByPost.get(row.id) ?? []).length,
        liked_by_me: myLiked.has(row.id),
        comment_preview_authors: buildCommentPreviewAvatars(
          commentsByPost.get(row.id) ?? []
        ),
      }))
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session?.user) {
          if (!cancelled) {
            setLoadError(
              "No active session. Open the app from a logged-in tab, or sign in again and refresh."
            );
          }
          return;
        }

        try {
          const uid =
            coachPersonaForCommunity(pathname, impersonatingCoachId) ??
            session.user.id;
          const map = await fetchStaffAvatarMap([uid], session.access_token);
          let url: string | null = map[uid] ?? null;
          if (!url) {
            const { data: own } = await supabaseClient
              .from("profiles")
              .select("avatar_url")
              .eq("id", uid)
              .maybeSingle();
            url = own?.avatar_url ?? null;
          }
          if (!cancelled) setComposeAvatarUrl(url);
        } catch {
          if (!cancelled) setComposeAvatarUrl(null);
        }

        try {
          await loadCategories();
        } catch (e) {
          if (!cancelled) {
            const msg = supabaseErrorMessage(e);
            const hint = communityAccessHint(msg);
            setLoadError(
              [
                "Failed while loading categories (table community_categories).",
                "",
                msg,
                hint ?? "",
              ]
                .filter(Boolean)
                .join("\n")
            );
          }
          return;
        }

        try {
          await loadPosts();
        } catch (e) {
          if (!cancelled) {
            const msg = supabaseErrorMessage(e);
            const hint = communityAccessHint(msg);
            setLoadError(
              [
                "Failed while loading posts (table community_posts or joined profiles).",
                "",
                msg,
                hint ?? "",
              ]
                .filter(Boolean)
                .join("\n")
            );
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId, loadCategories, loadPosts, pathname]);

  const filteredPosts = useMemo(() => {
    if (filterSlug === "all") return posts;
    return posts.filter((p) => p.category?.slug === filterSlug);
  }, [posts, filterSlug]);

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  return (
    <>
      <StickyPageHeader
        title="Community"
        description="Browse posts or see where coaches and admins are based."
        tabs={
          <PageHeaderUnderlineTabs
            ariaLabel="Community views"
            items={[
              {
                kind: "link",
                href: pathname,
                label: "Feed",
                active: communityTab === "feed",
              },
              {
                kind: "link",
                href: `${pathname}?tab=map`,
                label: "Map",
                active: communityTab === "map",
              },
            ]}
          />
        }
      />

      {communityTab === "map" ? (
        <div className="mx-auto w-full max-w-6xl min-w-0">
          <CommunityMembersMap />
        </div>
      ) : (
      <div className="mx-auto flex min-h-0 w-full max-w-3xl min-w-0 flex-col gap-6">
      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold text-rose-900">Community data could not be loaded</p>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white/80 px-3 py-2 font-mono text-xs leading-relaxed text-rose-950 ring-1 ring-rose-100">
            {loadError}
          </pre>
          <p className="mt-2 text-xs text-rose-700/90">
            An empty feed does not produce this screen—the Supabase request returned an error.
            Use the message above (often “relation does not exist” = run the migration, or RLS =
            check profiles.role is coach or admin).
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setComposeOpen(true)}
        disabled={Boolean(loadError) || categories.length === 0}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {composeAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={composeAvatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
            <User className="h-5 w-5 text-slate-400" strokeWidth={1.75} aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1 text-base text-slate-500">Write something…</span>
      </button>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterSlug("all")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            filterSlug === "all"
              ? "bg-sky-700 text-white"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilterSlug(c.slug)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filterSlug === c.slug
                ? "bg-sky-700 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {filteredPosts.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
                onOpen={() => openDetail(post.id)}
                onPostsChanged={loadPosts}
              />
            </li>
          ))}
        </ul>
      )}

      {!loading && filteredPosts.length === 0 && !loadError ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No posts yet. Start the conversation.
        </p>
      ) : null}

      {composeOpen ? (
        <CreatePostModal
          categories={categories}
          onClose={() => setComposeOpen(false)}
          onCreated={async () => {
            setComposeOpen(false);
            await loadPosts();
          }}
        />
      ) : null}

      {communityTab === "feed" && selectedPost ? (
        <PostDetailModal
          post={selectedPost}
          categories={categories}
          onClose={closeDetail}
          onPostsChanged={loadPosts}
        />
      ) : null}
      </div>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { CreatePostModal } from "@/components/community/CreatePostModal";
import { PostDetailModal } from "@/components/community/PostDetailModal";
import { PostCard } from "@/components/community/PostCard";

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
  is_pinned: boolean;
  created_at: string;
  category_id: string;
  category: CommunityCategory | null;
  author: ProfileRow | null;
};

export function CommunityFeed() {
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [filterSlug, setFilterSlug] = useState<string | "all">("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("community_categories")
      .select("id, slug, label")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    setCategories((data ?? []) as CommunityCategory[]);
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("community_posts")
      .select(
        `
        id,
        title,
        body,
        is_pinned,
        created_at,
        category_id,
        category:community_categories ( id, slug, label ),
        author:profiles ( id, full_name, first_name, last_name, avatar_url )
      `
      )
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    const rows = (data ?? []) as Array<
      Omit<CommunityPostRow, "category" | "author"> & {
        category: CommunityCategory | CommunityCategory[] | null;
        author: ProfileRow | ProfileRow[] | null;
      }
    >;
    setPosts(
      rows.map((row) => ({
        ...row,
        category: Array.isArray(row.category)
          ? row.category[0] ?? null
          : row.category ?? null,
        author: Array.isArray(row.author)
          ? row.author[0] ?? null
          : row.author ?? null,
      }))
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        await loadCategories();
        await loadPosts();
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Could not load community."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCategories, loadPosts]);

  const filteredPosts = useMemo(() => {
    if (filterSlug === "all") return posts;
    return posts.filter((p) => p.category?.slug === filterSlug);
  }, [posts, filterSlug]);

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  return (
    <div className="mx-auto w-full max-w-3xl pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Community</h1>
        <p className="mt-1 text-sm text-slate-600">
          Posts and updates for coaches and admins.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {loadError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setComposeOpen(true)}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
          +
        </span>
        <span className="text-[15px] text-slate-500">Write something…</span>
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
                onOpen={() => setSelectedPostId(post.id)}
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

      {selectedPost ? (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPostId(null)}
          onPostsChanged={loadPosts}
        />
      ) : null}
    </div>
  );
}

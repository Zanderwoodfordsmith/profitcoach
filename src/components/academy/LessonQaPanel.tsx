"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

import {
  enrichRawCommunityPostRows,
  type CommunityCategory,
  type CommunityPostRow,
  type RawCommunityPostRow,
} from "@/components/community/CommunityFeed";
import { CreatePostModal } from "@/components/community/CreatePostModal";
import { PostCard } from "@/components/community/PostCard";
import { PostDetailModal } from "@/components/community/PostDetailModal";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  lessonCommunityCategorySlug,
  lessonCommunityComposerPlaceholder,
  lessonCommunityTabLabel,
  lessonUsesCommunityChannelHistory,
} from "@/lib/academy/lessonCommunityChannel";
import {
  coachPersonaForCommunity,
  getCommunityAuthorId,
} from "@/lib/communityEffectiveAuthorId";
import {
  communityPostHasViewerEngagement,
  isCommunityPostReadOnFeed,
  useCommunityFeedCardLocalState,
} from "@/lib/communityPostFeedLocalState";
import { profileInitialsFromName } from "@/lib/communityProfile";
import { isMissingFeedCounterColumnError } from "@/lib/communitySupabaseErrors";
import {
  communityAccessHint,
  supabaseErrorMessage,
} from "@/lib/supabaseErrorMessage";
import { supabaseClient } from "@/lib/supabaseClient";

const LESSON_QA_SELECT = `
  id,
  title,
  body,
  image_url,
  media,
  is_pinned,
  published_at,
  created_at,
  category_id,
  visibility,
  feed_comment_count,
  feed_like_count,
  feed_poll_vote_count,
  last_comment_at,
  category:community_categories!category_id ( id, slug, label ),
  author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
`;

/** Without migration `20260608120000_community_posts_feed_counters`. */
const LESSON_QA_SELECT_LEGACY = `
  id,
  title,
  body,
  image_url,
  media,
  is_pinned,
  published_at,
  created_at,
  category_id,
  visibility,
  feed_poll_vote_count,
  category:community_categories!category_id ( id, slug, label ),
  author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
`;

type Props = {
  courseId: string;
  lessonId: string;
  /** Current lesson URL path for notification deep links. */
  lessonPath: string;
  viewerIsAdmin?: boolean | null;
};

export function LessonQaPanel({
  courseId,
  lessonId,
  lessonPath,
  viewerIsAdmin = null,
}: Props) {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeAvatarUrl, setComposeAvatarUrl] = useState<string | null>(null);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [viewerProfileId, setViewerProfileId] = useState<string | null>(null);
  const [visibilityById, setVisibilityById] = useState<Record<string, string>>(
    {}
  );
  const [feedMentionNameById] = useState<Record<string, string>>({});

  const openPost = useMemo(
    () => posts.find((p) => p.id === openPostId) ?? null,
    [posts, openPostId]
  );

  const {
    snapshot: feedLocalSnapshot,
    markPostRead,
    markPostUnread,
    markOwnPostsRead,
    markEngagedPostsRead,
  } = useCommunityFeedCardLocalState(viewerProfileId);
  /** Own / engaged read sync per scope; must not undo a deliberate "mark unread". */
  const autoReadSyncedRef = useRef<{
    scopeId: string | null;
    postIds: Set<string>;
  }>({ scopeId: null, postIds: new Set() });

  const channelLabel = lessonCommunityTabLabel(lessonId);
  const composerPlaceholder = lessonCommunityComposerPlaceholder(lessonId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const authorId = await getCommunityAuthorId(
        coachPersonaForCommunity(pathname, impersonatingCoachId, viewerIsAdmin)
      );
      setViewerProfileId(authorId);

      if (authorId) {
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("avatar_url")
          .eq("id", authorId)
          .maybeSingle();
        setComposeAvatarUrl((profile?.avatar_url as string | null) ?? null);
      }

      const categorySlug = lessonCommunityCategorySlug(lessonId);
      const { data: cats, error: catErr } = await supabaseClient
        .from("community_categories")
        .select("id, slug, label")
        .eq("slug", categorySlug);
      if (catErr) throw catErr;
      const loadedCategories = (cats ?? []) as CommunityCategory[];
      setCategories(loadedCategories);

      const categoryId = loadedCategories[0]?.id;
      const showChannelHistory = lessonUsesCommunityChannelHistory(lessonId);

      const runQuery = (select: string) => {
        let query = supabaseClient
          .from("community_posts")
          .select(select.trim());

        if (showChannelHistory && categoryId) {
          // Wins / Intros lessons mirror their complete community channels,
          // including older feed posts that predate lesson-scoped posting.
          query = query
            .eq("category_id", categoryId)
            .or(
              `published_at.is.null,published_at.lte.${new Date().toISOString()}`
            );
          return query
            .order("published_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });
        } else {
          query = query
            .eq("post_scope", "lesson_qa")
            .eq("lesson_id", lessonId);
        }

        return query.order("created_at", { ascending: false });
      };

      let res = await runQuery(LESSON_QA_SELECT);
      if (res.error && isMissingFeedCounterColumnError(res.error)) {
        res = await runQuery(LESSON_QA_SELECT_LEGACY);
      }
      if (res.error) throw res.error;
      const raw = (res.data ?? []) as unknown as (RawCommunityPostRow & {
        visibility?: string | null;
      })[];

      const visibility: Record<string, string> = {};
      for (const row of raw) {
        if (row.id && row.visibility) visibility[row.id] = row.visibility;
      }
      setVisibilityById(visibility);

      const enriched = await enrichRawCommunityPostRows(raw, {
        viewerProfileId: authorId,
        includeLadderLevel: false,
      });
      setPosts(enriched);
    } catch (err) {
      const msg = supabaseErrorMessage(err);
      setError(
        `${msg}${communityAccessHint(msg) ?? ""}` ||
          `Failed to load ${lessonCommunityTabLabel(lessonId)}.`
      );
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [impersonatingCoachId, lessonId, pathname, viewerIsAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  // Mirrors the community feed: your own posts and ones you already engaged
  // with start out read, so only genuinely new posts stand out.
  useEffect(() => {
    if (!viewerProfileId) return;
    if (autoReadSyncedRef.current.scopeId !== viewerProfileId) {
      autoReadSyncedRef.current = { scopeId: viewerProfileId, postIds: new Set() };
    }
    const synced = autoReadSyncedRef.current.postIds;
    const candidates = posts.filter(
      (p) =>
        !synced.has(p.id) &&
        !feedLocalSnapshot.readPostIds[p.id] &&
        !feedLocalSnapshot.unreadPostIds[p.id]
    );
    const ownToSync = candidates.filter((p) => p.author?.id === viewerProfileId);
    const engagedToSync = candidates.filter((p) =>
      communityPostHasViewerEngagement(p)
    );
    if (ownToSync.length === 0 && engagedToSync.length === 0) return;
    for (const p of [...ownToSync, ...engagedToSync]) synced.add(p.id);
    if (ownToSync.length > 0) markOwnPostsRead(ownToSync);
    if (engagedToSync.length > 0) markEngagedPostsRead(engagedToSync);
  }, [
    feedLocalSnapshot.readPostIds,
    feedLocalSnapshot.unreadPostIds,
    markEngagedPostsRead,
    markOwnPostsRead,
    posts,
    viewerProfileId,
  ]);

  const openDetail = useCallback(
    (postId: string) => {
      setOpenPostId(postId);
      markPostRead(postId, { clearExplicitUnread: true });
    },
    [markPostRead]
  );

  function onPostLocalUpdate(
    postId: string,
    patch: (post: CommunityPostRow) => Partial<CommunityPostRow>
  ) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...patch(p) } : p))
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className={composeOpen ? "relative z-50" : undefined}>
        {composeOpen ? (
          <>
            <button
              type="button"
              aria-label="Close composer overlay"
              onClick={() => setComposeOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-black/45"
            />
            <CreatePostModal
              categories={categories}
              avatarUrl={composeAvatarUrl}
              authorLabel="You"
              onClose={() => setComposeOpen(false)}
              viewerIsAdmin={viewerIsAdmin}
              lessonContext={{ courseId, lessonId, lessonPath }}
              onCreated={async () => {
                setComposeOpen(false);
                await load();
              }}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            disabled={Boolean(error) && categories.length === 0}
            className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
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
                <span className="text-sm font-semibold text-slate-600">
                  {profileInitialsFromName("Me")}
                </span>
              </span>
            )}
            <span className="min-w-0 flex-1 text-base text-slate-500">
              {composerPlaceholder}
            </span>
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Nothing here yet. Public posts also appear in the community{" "}
          {channelLabel} channel.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => {
            const isPrivate = visibilityById[post.id] === "private";
            return (
              <li key={post.id} className="relative">
                {isPrivate ? (
                  <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                    <Lock className="h-3 w-3" aria-hidden />
                    Private
                  </span>
                ) : null}
                <PostCard
                  post={post}
                  feedMentionNameById={feedMentionNameById}
                  feedCardHasBeenRead={isCommunityPostReadOnFeed(
                    post,
                    feedLocalSnapshot
                  )}
                  onOpen={() => openDetail(post.id)}
                  onPostLocalUpdate={onPostLocalUpdate}
                />
              </li>
            );
          })}
        </ul>
      )}

      {openPost ? (
        <PostDetailModal
          post={openPost}
          categories={categories}
          onClose={() => setOpenPostId(null)}
          onPostsChanged={load}
          onPostLocalUpdate={onPostLocalUpdate}
          feedStorageScopeId={viewerProfileId}
          viewerIsAdmin={viewerIsAdmin}
          feedPostIsUnread={!isCommunityPostReadOnFeed(openPost, feedLocalSnapshot)}
          onMarkPostRead={markPostRead}
          onMarkPostUnread={markPostUnread}
        />
      ) : null}
    </div>
  );
}

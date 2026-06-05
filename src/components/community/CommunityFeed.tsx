"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { FilterSlidersIcon } from "@/components/icons/FilterSlidersIcon";
import { DateTime } from "luxon";
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
import {
  isMissingFeedCounterColumnError,
  isUndefinedRelationError,
} from "@/lib/communitySupabaseErrors";
import {
  fetchStaffAvatarMap,
  mergeAuthorAvatar,
} from "@/lib/communityStaffAvatars";
import {
  getValidSupabaseAccessToken,
  resolveSupabaseBrowserSession,
} from "@/lib/supabaseAccessToken";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import { FEEDBACK_REQUEST_CATEGORY_SLUG } from "@/lib/coachAccess/tiers";
import {
  coachPersonaForCommunity,
  communityFeedStorageScopeId,
} from "@/lib/communityEffectiveAuthorId";
import {
  communityPostHasViewerEngagement,
  isCommunityPostReadOnFeed,
  useCommunityFeedCardLocalState,
  type CommunityFeedLocalState,
} from "@/lib/communityPostFeedLocalState";
import { fetchHighestAchievedLevelByUserIds } from "@/lib/communityAuthorLadderLevel";
import { CommunityMembersMap } from "@/components/community/CommunityMembersMap";
import { CommunitySidebar } from "@/components/community/CommunitySidebar";
import { extractMentionUserIds } from "@/lib/communityMentions";
import { fetchCommunityMentionNameMap } from "@/lib/communityFetchMentionNameMap";
import { capitalizeFirstUnicodeLetter } from "@/lib/communityPostCapitalize";
import {
  firstCommunityPostImageUrl,
  normalizeCommunityPostMedia,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";
import { devPerfEnd, devPerfStart } from "@/lib/devPerf";
import { paginationItems } from "@/lib/communityPagination";
import { profileInitialsFromName } from "@/lib/communityProfile";
import { expandCommunityCalendar } from "@/lib/communityCalendarExpand";
import type {
  CommunityCalendarOccurrence,
} from "@/lib/communityCalendarTypes";
import {
  communityCalendarOccurrenceKey,
  isActiveCommunityCalendarOccurrence,
} from "@/lib/communityCalendarTypes";
import { CommunityCalendarEventModal } from "@/components/community/CommunityCalendarEventModal";
import { formatCommunityEventHappeningWhen } from "@/lib/communityRelativeTime";
import {
  buildLoginUrl,
  coachCommunityPathFromAdminPath,
} from "@/lib/auth/loginReturnPath";

const POSTS_PER_PAGE = 20;
/**
 * Pagination contract:
 * - Page 1 renders fast by fetching only `FEED_FIRST_SCREEN_COUNT` first.
 * - Page 1 then fetches the rest of that same page in a second request.
 * - Page 2+ always use a single paginated request.
 */
const FEED_FIRST_SCREEN_COUNT = 3;

/** Show a community encouragement quote when the current page has fewer posts than a “full” page. */
const SPARSE_PAGE_POST_THRESHOLD = 10;

type SparseEncouragementQuote = { text: string; author: string };

const COMMUNITY_SPARSE_QUOTES: readonly SparseEncouragementQuote[] = [
  {
    text: "Never doubt that a small group of thoughtful, committed citizens can change the world; indeed, it's the only thing that ever has.",
    author: "Margaret Mead",
  },
  {
    text: "We are not put on this earth for ourselves, but are placed here for each other. If you are there always for others, then in time of need, someone will be there for you.",
    author: "Jeff Warner",
  },
  {
    text: "Only a life lived for others is a life worthwhile.",
    author: "Albert Einstein",
  },
  {
    text: "I don't know what your destiny will be, but one thing I do know: the only ones among you who will be really happy are those who have sought and found how to serve.",
    author: "Albert Schweitzer",
  },
];

function sparseEncouragementQuoteIndex(
  page: number,
  filterSlug: string,
  length: number
): number {
  if (length <= 0) return 0;
  let seed = page * 7919;
  for (let i = 0; i < filterSlug.length; i++) {
    seed = (seed * 31 + filterSlug.charCodeAt(i)) >>> 0;
  }
  return seed % length;
}

const COMMUNITY_POST_LIST_SELECT = `
        id,
        title,
        body,
        image_url,
        media,
        is_pinned,
        published_at,
        created_at,
        category_id,
        feed_comment_count,
        feed_like_count,
        feed_poll_vote_count,
        last_comment_at,
        category:community_categories!category_id ( id, slug, label ),
        author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
      `;

const COMMUNITY_POST_LIST_SELECT_LEGACY = `
        id,
        title,
        body,
        image_url,
        media,
        is_pinned,
        published_at,
        created_at,
        category_id,
        feed_poll_vote_count,
        category:community_categories!category_id ( id, slug, label ),
        author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
      `;

/** Nested select for `community_post_favourites` feed (order by favourite `created_at`). */
const COMMUNITY_POST_FAVOURITE_EMBED_SELECT = `
  created_at,
  post:community_posts!inner(
    id,
    title,
    body,
    image_url,
    media,
    is_pinned,
    published_at,
    created_at,
    category_id,
    feed_comment_count,
    feed_like_count,
    feed_poll_vote_count,
    last_comment_at,
    category:community_categories!category_id ( id, slug, label ),
    author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
  )
`;

const COMMUNITY_POST_FAVOURITE_EMBED_SELECT_LEGACY = `
  created_at,
  post:community_posts!inner(
    id,
    title,
    body,
    image_url,
    media,
    is_pinned,
    published_at,
    created_at,
    category_id,
    feed_poll_vote_count,
    category:community_categories!category_id ( id, slug, label ),
    author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
  )
`;

export type CommunityPostPoll = {
  kind: "poll";
  options: { id: string; text: string }[];
};

export type ProfileRow = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  /** Highest achieved ladder level id; loaded for community UI. */
  ladder_level?: string | null;
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
  /** Images and videos attached to the post (max 6). */
  media: CommunityPostMediaItem[];
  /** Optional poll (Skool-style). */
  poll: CommunityPostPoll | null;
  /** Distinct voters on this poll (denormalized on community_posts). */
  poll_vote_count: number;
  /** Signed-in user's current vote option id (or null if not voted). */
  poll_voted_option_id: string | null;
  /** First image URL (for thumbnails); null if the post has only videos or no media. */
  image_url: string | null;
  is_pinned: boolean;
  published_at?: string | null;
  created_at: string;
  category_id: string;
  category: CommunityCategory | null;
  author: ProfileRow | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  commented_by_me: boolean;
  /** Starred by the signed-in user (auth uid). */
  favourited_by_me: boolean;
  comment_preview_authors: ProfileRow[];
  /** Latest comment `created_at` in this thread, or null if there are no comments. */
  last_comment_at: string | null;
};

export type RawCommunityPostRow = Omit<
  CommunityPostRow,
  | "category"
  | "author"
  | "like_count"
  | "comment_count"
  | "liked_by_me"
  | "commented_by_me"
  | "favourited_by_me"
  | "comment_preview_authors"
  | "last_comment_at"
  | "media"
  | "poll_vote_count"
  | "poll_voted_option_id"
> & {
  category: CommunityCategory | CommunityCategory[] | null;
  author: ProfileRow | ProfileRow[] | null;
  media?: unknown;
  poll?: unknown;
  /** Present after migration `20260608120000_community_posts_feed_counters`. */
  feed_comment_count?: number;
  feed_like_count?: number;
  last_comment_at?: string | null;
  /** Present after migration `20260506120000_community_polls`. */
  feed_poll_vote_count?: number;
};

type EnrichCommunityPostsOptions = {
  /** Optional optimization for page-1 first paint. */
  includeLadderLevel?: boolean;
  /** Auth user or impersonated coach — drives liked/commented-by-me flags. */
  viewerProfileId?: string | null;
};

function isMissingPublishedAtColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  return (
    maybe.code === "42703" &&
    typeof maybe.message === "string" &&
    maybe.message.includes("community_posts.published_at")
  );
}

type NormalizedPostRow = Omit<
  CommunityPostRow,
  | "like_count"
  | "comment_count"
  | "liked_by_me"
  | "commented_by_me"
  | "favourited_by_me"
  | "comment_preview_authors"
  | "last_comment_at"
> & {
  /** Server-maintained counts when migration is applied; otherwise null → legacy enrich queries. */
  prefillEngagement: {
    likeCount: number;
    commentCount: number;
    lastCommentAt: string | null;
  } | null;
};

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

function normalizeRawPostRows(rows: RawCommunityPostRow[]): NormalizedPostRow[] {
  return rows.map((row) => {
    const {
      feed_comment_count: feedCommentCount,
      feed_like_count: feedLikeCount,
      last_comment_at: lastCommentAtCol,
      feed_poll_vote_count: feedPollVoteCount,
      ...rowCore
    } = row;
    const media = normalizeCommunityPostMedia(row.media, row.image_url);
    const image_url = firstCommunityPostImageUrl(media);
    const prefillEngagement =
      typeof feedCommentCount === "number" && typeof feedLikeCount === "number"
        ? {
            likeCount: feedLikeCount,
            commentCount: feedCommentCount,
            lastCommentAt: lastCommentAtCol ?? null,
          }
        : null;

    const poll =
      row.poll && typeof row.poll === "object"
        ? (row.poll as CommunityPostPoll)
        : null;
    const poll_vote_count = typeof feedPollVoteCount === "number" ? feedPollVoteCount : 0;
    return {
      ...rowCore,
      media,
      poll,
      poll_vote_count,
      poll_voted_option_id: null,
      image_url,
      title: capitalizeFirstUnicodeLetter(row.title),
      body: capitalizeFirstUnicodeLetter(row.body),
      category: Array.isArray(row.category)
        ? row.category[0] ?? null
        : row.category ?? null,
      author: Array.isArray(row.author)
        ? row.author[0] ?? null
        : row.author ?? null,
      prefillEngagement,
    };
  });
}

function dedupePostsById(rows: CommunityPostRow[]): CommunityPostRow[] {
  if (rows.length <= 1) return rows;
  const seen = new Set<string>();
  const deduped: CommunityPostRow[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    deduped.push(row);
  }
  return deduped;
}

function toLightweightFeedPosts(
  normalized: NormalizedPostRow[],
  options?: { favouritedByMe?: boolean }
): CommunityPostRow[] {
  return normalized.map((row) => {
    const pre = row.prefillEngagement;
    const { prefillEngagement: _omitPrefill, ...rest } = row;
    void _omitPrefill;
    return {
      ...rest,
      like_count: pre?.likeCount ?? 0,
      comment_count: pre?.commentCount ?? 0,
      liked_by_me: false,
      commented_by_me: false,
      favourited_by_me: Boolean(options?.favouritedByMe),
      comment_preview_authors: [],
      last_comment_at: pre?.lastCommentAt ?? null,
      poll_voted_option_id: null,
    };
  });
}

async function enrichNormalizedCommunityPosts(
  normalized: NormalizedPostRow[],
  options?: EnrichCommunityPostsOptions
): Promise<CommunityPostRow[]> {
  if (normalized.length === 0) {
    return [];
  }

  const postIds = normalized.map((p) => p.id);
  const includeLadderLevel = options?.includeLadderLevel !== false;

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const uid = options?.viewerProfileId ?? user?.id;

  const favPromise =
    uid && postIds.length > 0
      ? supabaseClient
          .from("community_post_favourites")
          .select("post_id")
          .eq("user_id", uid)
          .in("post_id", postIds)
      : Promise.resolve({
          data: [] as { post_id: string }[] | null,
          error: null as null,
        });

  const myLikesPromise =
    uid && postIds.length > 0
      ? supabaseClient
          .from("community_post_likes")
          .select("post_id")
          .eq("user_id", uid)
          .in("post_id", postIds)
      : Promise.resolve({
          data: [] as { post_id: string }[] | null,
          error: null,
        });

  const myPollVotesPromise =
    uid && postIds.length > 0
      ? supabaseClient
          .from("community_post_poll_votes")
          .select("post_id, option_id")
          .eq("voter_id", uid)
          .in("post_id", postIds)
      : Promise.resolve({
          data: [] as { post_id: string; option_id: string }[] | null,
          error: null as null,
        });

  const myCommentsPromise =
    uid && postIds.length > 0
      ? supabaseClient
          .from("community_post_comments")
          .select("post_id")
          .eq("author_id", uid)
          .in("post_id", postIds)
      : Promise.resolve({
          data: [] as { post_id: string }[] | null,
          error: null as null,
        });

  const [favRes, myLikesRes, myPollVotesRes, myCommentsRes] = await Promise.all([
    favPromise,
    myLikesPromise,
    myPollVotesPromise,
    myCommentsPromise,
  ]);

  if (favRes.error && !isUndefinedRelationError(favRes.error)) {
    throw favRes.error;
  }
  if (myLikesRes.error && !isUndefinedRelationError(myLikesRes.error)) {
    throw myLikesRes.error;
  }
  if (myPollVotesRes.error && !isUndefinedRelationError(myPollVotesRes.error)) {
    throw myPollVotesRes.error;
  }
  if (myCommentsRes.error && !isUndefinedRelationError(myCommentsRes.error)) {
    throw myCommentsRes.error;
  }

  const likesTableMissing = Boolean(
    myLikesRes.error && isUndefinedRelationError(myLikesRes.error)
  );
  if (likesTableMissing && process.env.NODE_ENV === "development") {
    console.warn(
      "[Community] community_post_likes query failed (table missing?). Run migration 20260508120000_community_post_likes.sql. Likes will show as 0 until then."
    );
  }

  const favTableMissing = Boolean(
    favRes.error && isUndefinedRelationError(favRes.error)
  );
  if (favTableMissing && process.env.NODE_ENV === "development") {
    console.warn(
      "[Community] community_post_favourites query failed (table missing?). Run migration 20260607130000_community_post_favourites.sql."
    );
  }

  let myLiked = new Set<string>();
  if (uid && !likesTableMissing && !myLikesRes.error) {
    myLiked = new Set(
      (myLikesRes.data ?? []).map((r: { post_id: string }) => r.post_id)
    );
  }

  let myFavourited = new Set<string>();
  if (uid && !favTableMissing && !favRes.error) {
    myFavourited = new Set(
      (favRes.data ?? []).map((r: { post_id: string }) => r.post_id)
    );
  }

  const myPollVoteByPostId = new Map<string, string>();
  if (uid && !myPollVotesRes.error) {
    for (const r of (myPollVotesRes.data ?? []) as {
      post_id: string;
      option_id: string;
    }[]) {
      myPollVoteByPostId.set(r.post_id, r.option_id);
    }
  }

  let myCommented = new Set<string>();
  if (uid && !myCommentsRes.error) {
    myCommented = new Set(
      (myCommentsRes.data ?? []).map((r: { post_id: string }) => r.post_id)
    );
  }

  let denormFastPath =
    normalized.length > 0 &&
    normalized.every((n) => n.prefillEngagement !== null);

  let commentsNormalized: CommentAuthorRow[] = [];
  let likeCountByPost = new Map<string, number>();

  if (denormFastPath) {
    const previewRpc = await supabaseClient.rpc(
      "community_feed_comment_preview_rows",
      { p_post_ids: postIds }
    );
    if (!previewRpc.error && Array.isArray(previewRpc.data)) {
      type RpcRow = {
        post_id: string;
        author_id: string;
        created_at: string;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
      };
      commentsNormalized = (previewRpc.data as RpcRow[]).map((r) => ({
        post_id: r.post_id,
        author_id: r.author_id,
        created_at: r.created_at,
        author: {
          id: r.author_id,
          full_name: r.full_name,
          first_name: r.first_name,
          last_name: r.last_name,
          avatar_url: r.avatar_url,
        },
      }));
    } else {
      denormFastPath = false;
      if (process.env.NODE_ENV === "development" && previewRpc.error) {
        console.warn(
          "[Community] community_feed_comment_preview_rows RPC failed; using legacy comment fetch.",
          previewRpc.error.message
        );
      }
    }
  }

  if (!denormFastPath) {
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
          author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
        `
        )
        .in("post_id", postIds)
        .order("created_at", { ascending: true }),
    ]);

    if (likesRes.error && !isUndefinedRelationError(likesRes.error)) {
      throw likesRes.error;
    }
    if (commentsRes.error) throw commentsRes.error;

    const likesMissingLegacy = Boolean(
      likesRes.error && isUndefinedRelationError(likesRes.error)
    );
    if (likesMissingLegacy && process.env.NODE_ENV === "development") {
      console.warn(
        "[Community] community_post_likes bulk query failed (legacy path)."
      );
    }

    const likeRows = (likesMissingLegacy ? [] : likesRes.data ?? []) as {
      post_id: string;
      user_id: string;
    }[];
    for (const r of likeRows) {
      likeCountByPost.set(
        r.post_id,
        (likeCountByPost.get(r.post_id) ?? 0) + 1
      );
    }

    const rawComments = (commentsRes.data ?? []) as Array<
      Omit<CommentAuthorRow, "author"> & {
        author: ProfileRow | ProfileRow[] | null;
      }
    >;
    commentsNormalized = rawComments.map((row) => ({
      post_id: row.post_id,
      author_id: row.author_id,
      created_at: row.created_at,
      author: Array.isArray(row.author)
        ? row.author[0] ?? null
        : row.author ?? null,
    }));
  }

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

  if (includeLadderLevel) {
    const ladderByUser = await fetchHighestAchievedLevelByUserIds(avatarUserIds);
    normalizedWithAvatars = normalizedWithAvatars.map((row) => ({
      ...row,
      author: row.author?.id
        ? {
            ...row.author,
            ladder_level: ladderByUser.get(row.author.id) ?? null,
          }
        : row.author,
    }));
    commentsWithAvatars = commentsWithAvatars.map((c) => ({
      ...c,
      author: c.author?.id
        ? {
            ...c.author,
            ladder_level: ladderByUser.get(c.author_id) ?? null,
          }
        : c.author,
    }));
  }

  const commentsByPost = new Map<string, CommentAuthorRow[]>();
  for (const c of commentsWithAvatars) {
    const arr = commentsByPost.get(c.post_id) ?? [];
    arr.push(c);
    commentsByPost.set(c.post_id, arr);
  }

  return normalizedWithAvatars.map((row) => {
    const thread = commentsByPost.get(row.id) ?? [];
    const pre = row.prefillEngagement;
    let last_comment_at: string | null;
    let like_count: number;
    let comment_count: number;
    if (denormFastPath && pre) {
      like_count = pre.likeCount;
      comment_count = pre.commentCount;
      last_comment_at = pre.lastCommentAt;
    } else {
      like_count = likeCountByPost.get(row.id) ?? 0;
      comment_count = thread.length;
      last_comment_at = null;
      for (const c of thread) {
        if (
          !last_comment_at ||
          new Date(c.created_at) > new Date(last_comment_at)
        ) {
          last_comment_at = c.created_at;
        }
      }
    }
    const { prefillEngagement: _omitPrefill, ...rest } = row;
    void _omitPrefill;
    return {
      ...rest,
      like_count,
      comment_count,
      liked_by_me: myLiked.has(row.id),
      commented_by_me: myCommented.has(row.id),
      favourited_by_me: !favTableMissing && myFavourited.has(row.id),
      poll_voted_option_id: myPollVoteByPostId.get(row.id) ?? null,
      comment_preview_authors: buildCommentPreviewAvatars(thread),
      last_comment_at,
    };
  });
}

/** Normalize + enrich post rows already loaded from Supabase (admin wins queue). */
export async function enrichRawCommunityPostRows(
  rawRows: RawCommunityPostRow[],
  options?: EnrichCommunityPostsOptions
): Promise<CommunityPostRow[]> {
  if (rawRows.length === 0) return [];
  const normalized = normalizeRawPostRows(rawRows);
  return enrichNormalizedCommunityPosts(normalized, options);
}

/** Fetch and enrich posts by id (detail modal, admin wins queue). */
export async function fetchEnrichedCommunityPostsByIds(
  ids: string[],
  options?: EnrichCommunityPostsOptions
): Promise<CommunityPostRow[]> {
  if (ids.length === 0) return [];

  const nowIso = new Date().toISOString();

  const runQuery = (select: string) =>
    supabaseClient
      .from("community_posts")
      .select(select.trim())
      .in("id", ids)
      .lte("published_at", nowIso);

  let res = await runQuery(COMMUNITY_POST_LIST_SELECT);
  if (res.error && isMissingFeedCounterColumnError(res.error)) {
    res = await runQuery(COMMUNITY_POST_LIST_SELECT_LEGACY);
  }
  if (res.error) throw res.error;

  const rows = (res.data ?? []) as unknown as RawCommunityPostRow[];
  const normalized = normalizeRawPostRows(rows);
  return enrichNormalizedCommunityPosts(normalized, options);
}

function isCommunityPostUnreadOnFeed(
  post: CommunityPostRow,
  snapshot: CommunityFeedLocalState
): boolean {
  return !isCommunityPostReadOnFeed(post, snapshot);
}

function isFutureScheduledPost(post: CommunityPostRow): boolean {
  if (!post.published_at) return false;
  const at = new Date(post.published_at).getTime();
  if (Number.isNaN(at)) return false;
  return at > Date.now();
}

/** Fields synced from the post modal (or card) without reloading the feed. */
type FeedEngagementOverride = Pick<
  CommunityPostRow,
  | "liked_by_me"
  | "like_count"
  | "comment_count"
  | "commented_by_me"
  | "last_comment_at"
>;

function pickFeedEngagementOverride(
  patch: Partial<CommunityPostRow>
): Partial<FeedEngagementOverride> {
  const out: Partial<FeedEngagementOverride> = {};
  if (patch.liked_by_me !== undefined) out.liked_by_me = patch.liked_by_me;
  if (patch.like_count !== undefined) out.like_count = patch.like_count;
  if (patch.comment_count !== undefined) out.comment_count = patch.comment_count;
  if (patch.commented_by_me !== undefined) {
    out.commented_by_me = patch.commented_by_me;
  }
  if (patch.last_comment_at !== undefined) {
    out.last_comment_at = patch.last_comment_at;
  }
  return out;
}

function applyFeedEngagementOverrides(
  rows: CommunityPostRow[],
  overrides: Record<string, Partial<FeedEngagementOverride>>
): CommunityPostRow[] {
  if (Object.keys(overrides).length === 0) return rows;
  return rows.map((p) => {
    const o = overrides[p.id];
    return o ? { ...p, ...o } : p;
  });
}

function mergeFeedEngagementOverride(
  overrides: Record<string, Partial<FeedEngagementOverride>>,
  postId: string,
  patch: Partial<FeedEngagementOverride>
): void {
  const prev = overrides[postId] ?? {};
  const next = { ...prev, ...patch };
  if (Object.keys(next).length === 0) {
    delete overrides[postId];
  } else {
    overrides[postId] = next;
  }
}

export function CommunityFeed() {
  const { impersonatingCoachId } = useImpersonation();
  const { hasFeature, loading: accessLoading } = useCoachAccess(
    impersonatingCoachId
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /**
   * Always-current snapshot of searchParams for effects that should read the
   * latest query string without re-running every time it changes (e.g. opening
   * or closing a post via ?post= must not trigger a full feed reload).
   */
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const communityTab =
    searchParams.get("tab") === "map" ? "map" : "feed";

  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const visibleCategories = useMemo(() => {
    if (accessLoading || hasFeature("community.feedback_channel")) {
      return categories;
    }
    return categories.filter((c) => c.slug !== FEEDBACK_REQUEST_CATEGORY_SLUG);
  }, [accessLoading, categories, hasFeature]);

  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [feedMentionNameById, setFeedMentionNameById] = useState<
    Record<string, string>
  >({});
  const [filterSlug, setFilterSlug] = useState<string | "all">("all");
  const [readFilter, setReadFilter] = useState<
    "all" | "read" | "unread" | "favourites"
  >("all");
  const [readFilterMenuOpen, setReadFilterMenuOpen] = useState(false);
  const [scheduledPostsOpen, setScheduledPostsOpen] = useState(true);
  const readFilterMenuRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [composeAvatarUrl, setComposeAvatarUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (accessLoading) return;
    if (
      filterSlug === FEEDBACK_REQUEST_CATEGORY_SLUG &&
      !hasFeature("community.feedback_channel")
    ) {
      setFilterSlug("all");
      setPage(1);
    }
  }, [accessLoading, filterSlug, hasFeature]);

  const [totalCount, setTotalCount] = useState(0);
  const [fetchedDetailPost, setFetchedDetailPost] =
    useState<CommunityPostRow | null>(null);
  const [feedBootstrapOk, setFeedBootstrapOk] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [feedCountersAvailable, setFeedCountersAvailable] = useState(true);
  const [publishedAtAvailable, setPublishedAtAvailable] = useState(true);
  const [viewerIsAdmin, setViewerIsAdmin] = useState<boolean | null>(null);
  const [communityAuthUserId, setCommunityAuthUserId] = useState<
    string | null
  >(null);
  const feedStorageScopeId = communityFeedStorageScopeId(
    pathname,
    impersonatingCoachId,
    communityAuthUserId,
    viewerIsAdmin
  );
  const {
    snapshot: feedLocalSnapshot,
    markPostRead,
    markPostUnread,
    markCommentsSeenUpTo,
    markOwnPostsRead,
    markEngagedPostsRead,
  } = useCommunityFeedCardLocalState(feedStorageScopeId);
  const feedViewerProfileIdRef = useRef<string | null>(feedStorageScopeId);
  feedViewerProfileIdRef.current = feedStorageScopeId;
  const prevFeedStorageScopeIdRef = useRef<string | null>(null);
  const pendingReadPostIdsRef = useRef<string[]>([]);
  /** Own-post read sync per scope; avoids undoing a deliberate "mark unread". */
  const ownPostsReadSyncedRef = useRef<{
    scopeId: string | null;
    postIds: Set<string>;
  }>({ scopeId: null, postIds: new Set() });
  const markPostReadWithRetry = useCallback(
    (postId: string) => {
      if (feedStorageScopeId) {
        markPostRead(postId);
        return;
      }
      pendingReadPostIdsRef.current.push(postId);
    },
    [feedStorageScopeId, markPostRead]
  );
  const canPreviewScheduledPosts =
    viewerIsAdmin === true || pathname.startsWith("/admin");
  /** Bumps when the feed should reload while staying on the same page (e.g. new post). */
  const [postsRefreshNonce, setPostsRefreshNonce] = useState(0);
  /** Cancels in-flight split-page loads when filters or nonce change. */
  const feedFetchGeneration = useRef(0);
  /** Keeps modal/card engagement patches when split-page enrich replaces `posts`. */
  const feedEngagementOverridesRef = useRef<
    Record<string, Partial<FeedEngagementOverride>>
  >({});
  /** Latest detail post for flushing engagement when the modal closes. */
  const selectedPostEngagementRef = useRef<CommunityPostRow | null>(null);
  /** Page 1: after the first few posts, loading the rest of the page. */
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [calendarLiveOccurrence, setCalendarLiveOccurrence] =
    useState<CommunityCalendarOccurrence | null>(null);
  const [calendarNextOccurrence, setCalendarNextOccurrence] =
    useState<CommunityCalendarOccurrence | null>(null);
  const [selectedCalendarOccurrence, setSelectedCalendarOccurrence] =
    useState<CommunityCalendarOccurrence | null>(null);
  const [calendarTick, setCalendarTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void resolveSupabaseBrowserSession().then((session) => {
      if (!cancelled && session?.user) {
        setCommunityAuthUserId(session.user.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!feedBootstrapOk || !feedStorageScopeId) return;
    const prev = prevFeedStorageScopeIdRef.current;
    prevFeedStorageScopeIdRef.current = feedStorageScopeId;
    if (prev !== null && prev !== feedStorageScopeId) {
      setPostsRefreshNonce((n) => n + 1);
    }
  }, [feedBootstrapOk, feedStorageScopeId]);

  useEffect(() => {
    if (!feedStorageScopeId || pendingReadPostIdsRef.current.length === 0) {
      return;
    }
    const pending = pendingReadPostIdsRef.current;
    pendingReadPostIdsRef.current = [];
    for (const id of pending) markPostRead(id);
  }, [feedStorageScopeId, markPostRead]);

  useEffect(() => {
    if (!feedStorageScopeId) return;
    if (ownPostsReadSyncedRef.current.scopeId !== feedStorageScopeId) {
      ownPostsReadSyncedRef.current = {
        scopeId: feedStorageScopeId,
        postIds: new Set(),
      };
    }
    const synced = ownPostsReadSyncedRef.current.postIds;
    const ownToSync = posts.filter(
      (p) =>
        p.author?.id === feedStorageScopeId &&
        !synced.has(p.id) &&
        !feedLocalSnapshot.readPostIds[p.id]
    );
    const engagedToSync = posts.filter(
      (p) =>
        !synced.has(p.id) &&
        !feedLocalSnapshot.readPostIds[p.id] &&
        communityPostHasViewerEngagement(p)
    );
    if (ownToSync.length === 0 && engagedToSync.length === 0) return;
    for (const p of [...ownToSync, ...engagedToSync]) synced.add(p.id);
    if (ownToSync.length > 0) markOwnPostsRead(ownToSync);
    if (engagedToSync.length > 0) markEngagedPostsRead(engagedToSync);
  }, [
    feedLocalSnapshot.readPostIds,
    feedStorageScopeId,
    markEngagedPostsRead,
    markOwnPostsRead,
    posts,
  ]);

  // Open/close the post modal by updating the `?post=` query with the History
  // API rather than the Next.js router. `CommunityFeed` reads `useSearchParams`
  // inside a Suspense boundary, so a `router.replace` here is treated as a
  // navigation that flashes the Suspense fallback — unmounting and remounting
  // the whole feed. That remount is what made the modal flicker open/closed and
  // the feed visibly reload on close (worse on slow connections). History
  // updates keep the URL shareable/back-navigable and stay in sync with
  // `useSearchParams` without triggering a navigation.
  const openDetail = useCallback(
    (id: string) => {
      setSelectedPostId(id);
      markPostRead(id);
      if (typeof window === "undefined") return;
      const sp = new URLSearchParams(window.location.search);
      sp.set("post", id);
      window.history.replaceState(null, "", `${pathname}?${sp.toString()}`);
    },
    [markPostRead, pathname]
  );

  useEffect(() => {
    const id = window.setInterval(() => setCalendarTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void calendarTick;
    let cancelled = false;
    void (async () => {
      const now = DateTime.now();
      const rangeEnd = now.plus({ days: 120 });
      const [eventsResult, exceptionsResult] = await Promise.all([
        supabaseClient
          .from("community_calendar_events")
          .select(
            "id, created_by, title, description, cover_image_url, starts_at, ends_at, display_timezone, location_kind, location_url, recording_link_url, recording_video_url, is_recurring, recurrence, created_at, updated_at"
          )
          .order("starts_at", { ascending: true }),
        supabaseClient
          .from("community_calendar_event_exceptions")
          .select(
            "id, event_id, occurrence_start, cancelled_at, cancellation_reason, recording_link_url, recording_video_url, rescheduled_starts_at, rescheduled_ends_at, omit_from_calendar, created_at"
          ),
      ]);
      if (cancelled || eventsResult.error || exceptionsResult.error) return;
      const occurrences = expandCommunityCalendar(
        (eventsResult.data ?? []) as Parameters<typeof expandCommunityCalendar>[0],
        now,
        rangeEnd,
        (exceptionsResult.data ?? []) as Parameters<
          typeof expandCommunityCalendar
        >[3]
      );
      const nowMs = now.toMillis();
      const activeOccurrences = occurrences.filter(isActiveCommunityCalendarOccurrence);
      const live =
        activeOccurrences.find((occ) => {
          const startMs = DateTime.fromISO(occ.startsAtIso, {
            zone: "utc",
          }).toMillis();
          const endMs = DateTime.fromISO(occ.endsAtIso, {
            zone: "utc",
          }).toMillis();
          return nowMs >= startMs && nowMs < endMs;
        }) ?? null;
      const next =
        live ??
        activeOccurrences.find((occ) => {
          const startMs = DateTime.fromISO(occ.startsAtIso, {
            zone: "utc",
          }).toMillis();
          return startMs > nowMs;
        }) ??
        null;
      setCalendarLiveOccurrence(live);
      setCalendarNextOccurrence(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [calendarTick]);

  useEffect(() => {
    const q = searchParams.get("post");
    if (q && /^[0-9a-f-]{36}$/i.test(q)) {
      setSelectedPostId(q);
    } else {
      setSelectedPostId(null);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("tab") !== "calendar") return;
    const base = pathname.startsWith("/admin")
      ? "/admin/community"
      : "/coach/community";
    router.replace(`${base}/calendar`);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!readFilterMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = readFilterMenuRef.current;
      if (el && !el.contains(e.target as Node)) setReadFilterMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [readFilterMenuOpen]);

  useEffect(() => {
    if (!selectedPostId) {
      setFetchedDetailPost(null);
      return;
    }
    if (posts.some((p) => p.id === selectedPostId)) {
      setFetchedDetailPost(null);
      return;
    }
    let cancelled = false;
    const id = selectedPostId;
    void (async () => {
      try {
        const detailQuery =
          publishedAtAvailable && !canPreviewScheduledPosts
            ? supabaseClient
                .from("community_posts")
                .select(
                  (
                    feedCountersAvailable
                      ? COMMUNITY_POST_LIST_SELECT
                      : COMMUNITY_POST_LIST_SELECT_LEGACY
                  ).trim()
                )
                .eq("id", id)
                .lte("published_at", new Date().toISOString())
                .maybeSingle()
            : supabaseClient
                .from("community_posts")
                .select(
                  (
                    feedCountersAvailable
                      ? COMMUNITY_POST_LIST_SELECT
                      : COMMUNITY_POST_LIST_SELECT_LEGACY
                  ).trim()
                )
                .eq("id", id)
                .maybeSingle();
        const { data, error } = await detailQuery;
        if (
          error &&
          feedCountersAvailable &&
          isMissingFeedCounterColumnError(error)
        ) {
          setFeedCountersAvailable(false);
          return;
        }
        if (cancelled || error || !data) return;
        const normalized = normalizeRawPostRows([
          data as unknown as RawCommunityPostRow,
        ]);
        const enriched = await enrichNormalizedCommunityPosts(normalized, {
          viewerProfileId: feedViewerProfileIdRef.current,
        });
        if (!cancelled && enriched[0]?.id === id) {
          setFetchedDetailPost(enriched[0]);
        }
      } catch {
        if (!cancelled) setFetchedDetailPost(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPostId, posts, feedCountersAvailable, publishedAtAvailable, canPreviewScheduledPosts]);

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("community_categories")
      .select("id, slug, label")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    setCategories((data ?? []) as CommunityCategory[]);
  }, []);

  const commitPostsToState = useCallback((rows: CommunityPostRow[]) => {
    setPosts(
      dedupePostsById(
        applyFeedEngagementOverrides(rows, feedEngagementOverridesRef.current)
      )
    );
  }, []);

  const loadPosts = useCallback(
    async (pageOverride?: number) => {
      feedFetchGeneration.current += 1;
      const gen = feedFetchGeneration.current;
      const perfMark = devPerfStart();
      const enrichOptions: EnrichCommunityPostsOptions = {
        viewerProfileId: feedViewerProfileIdRef.current,
      };
      setFeedLoadingMore(false);
      try {
        const effectivePage = pageOverride ?? page;
        const from = (effectivePage - 1) * POSTS_PER_PAGE;
        const to = from + POSTS_PER_PAGE - 1;
        if (to < from) {
          throw new Error("Community feed pagination range is invalid.");
        }

        const {
          data: { user },
        } = await supabaseClient.auth.getUser();

        const mapFavRows = (data: unknown) => {
          type FavJoinRow = {
            post: RawCommunityPostRow | RawCommunityPostRow[] | null;
          };
          return ((data ?? []) as unknown as FavJoinRow[])
            .map((r) => {
              const p = r.post;
              if (!p) return null;
              return Array.isArray(p) ? (p[0] ?? null) : p;
            })
            .filter((p): p is RawCommunityPostRow => Boolean(p));
        };

        const buildFavouritesQuery = (userId: string) => {
          let favQ = supabaseClient
            .from("community_post_favourites")
            .select(
              (
                feedCountersAvailable
                  ? COMMUNITY_POST_FAVOURITE_EMBED_SELECT
                  : COMMUNITY_POST_FAVOURITE_EMBED_SELECT_LEGACY
              ).trim(),
              { count: "exact" }
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
          if (filterSlug !== "all") {
            const cat = categories.find((c) => c.slug === filterSlug);
            if (cat) {
              favQ = favQ.eq("post.category_id", cat.id);
            }
          }
          if (publishedAtAvailable && !canPreviewScheduledPosts) {
            favQ = favQ.lte("post.published_at", new Date().toISOString());
          }
          return favQ;
        };

        const buildPostsQuery = () => {
          let q = supabaseClient
            .from("community_posts")
            .select(
              (
                feedCountersAvailable
                  ? COMMUNITY_POST_LIST_SELECT
                  : COMMUNITY_POST_LIST_SELECT_LEGACY
              ).trim(),
              { count: "exact" }
            )
            .order("is_pinned", { ascending: false })
            .order("created_at", { ascending: false });
          if (publishedAtAvailable) {
            q = q.order("published_at", { ascending: false });
            if (!canPreviewScheduledPosts) {
              q = q.lte("published_at", new Date().toISOString());
            }
          }
          if (filterSlug !== "all") {
            const cat = categories.find((c) => c.slug === filterSlug);
            if (cat) {
              q = q.eq("category_id", cat.id);
            }
          }
          return q;
        };

        if (readFilter === "favourites") {
          if (!user?.id) {
            setTotalCount(0);
            setPosts([]);
            return;
          }

          const splitFirst =
            effectivePage === 1 && POSTS_PER_PAGE > FEED_FIRST_SCREEN_COUNT;

          if (splitFirst) {
            const pageFirstPerfMark = devPerfStart();
            const first = await buildFavouritesQuery(user.id).range(
              0,
              FEED_FIRST_SCREEN_COUNT - 1
            );
            if (gen !== feedFetchGeneration.current) return;
            if (first.error) {
              if (
                publishedAtAvailable &&
                isMissingPublishedAtColumnError(first.error)
              ) {
                setPublishedAtAvailable(false);
                return;
              }
              if (isUndefinedRelationError(first.error)) {
                if (process.env.NODE_ENV === "development") {
                  console.warn(
                    "[Community] community_post_favourites missing. Run migration 20260607130000_community_post_favourites.sql."
                  );
                }
                setTotalCount(0);
                setPosts([]);
                return;
              }
              throw first.error;
            }
            const raw1 = mapFavRows(first.data);
            const normalized1 = normalizeRawPostRows(raw1);
            const firstScreenPosts = toLightweightFeedPosts(normalized1, {
              favouritedByMe: true,
            });
            if (gen !== feedFetchGeneration.current) return;
            const total = first.count ?? 0;
            setTotalCount(total);
            commitPostsToState(firstScreenPosts);
            devPerfEnd("communityFeed:page1:first3", pageFirstPerfMark);
            setPostsLoading(false);
            if (total <= FEED_FIRST_SCREEN_COUNT) {
              return;
            }
            setFeedLoadingMore(true);
            if (gen !== feedFetchGeneration.current) {
              setFeedLoadingMore(false);
              return;
            }
            const second = await buildFavouritesQuery(user.id).range(
              FEED_FIRST_SCREEN_COUNT,
              POSTS_PER_PAGE - 1
            );
            if (gen !== feedFetchGeneration.current) {
              setFeedLoadingMore(false);
              return;
            }
            if (second.error) {
              if (
                publishedAtAvailable &&
                isMissingPublishedAtColumnError(second.error)
              ) {
                setPublishedAtAvailable(false);
                setFeedLoadingMore(false);
                return;
              }
              if (
                feedCountersAvailable &&
                isMissingFeedCounterColumnError(second.error)
              ) {
                setFeedCountersAvailable(false);
                setFeedLoadingMore(false);
                return;
              }
              throw second.error;
            }
            const raw2 = mapFavRows(second.data);
            const mergedNormalized = normalizeRawPostRows([...raw1, ...raw2]);
            const enrichedAll = await enrichNormalizedCommunityPosts(
              mergedNormalized,
              enrichOptions
            );
            if (gen !== feedFetchGeneration.current) {
              setFeedLoadingMore(false);
              return;
            }
            commitPostsToState(
              enrichedAll.map((p) => ({ ...p, favourited_by_me: true as const }))
            );
            devPerfEnd("communityFeed:page1:full", pageFirstPerfMark);
            setFeedLoadingMore(false);
            return;
          }

          const { data, error, count } = await buildFavouritesQuery(
            user.id
          ).range(from, to);

          if (error) {
            if (publishedAtAvailable && isMissingPublishedAtColumnError(error)) {
              setPublishedAtAvailable(false);
              return;
            }
            if (feedCountersAvailable && isMissingFeedCounterColumnError(error)) {
              setFeedCountersAvailable(false);
              return;
            }
            if (isUndefinedRelationError(error)) {
              if (process.env.NODE_ENV === "development") {
                console.warn(
                  "[Community] community_post_favourites missing. Run migration 20260607130000_community_post_favourites.sql."
                );
              }
              setTotalCount(0);
              setPosts([]);
              return;
            }
            throw error;
          }

          const rawPosts = mapFavRows(data);
          const enriched = await enrichNormalizedCommunityPosts(
            normalizeRawPostRows(rawPosts),
            enrichOptions
          );
          setTotalCount(count ?? 0);
          commitPostsToState(
            enriched.map((p) => ({
              ...p,
              favourited_by_me: true,
            }))
          );
          return;
        }

        const splitFirst =
          effectivePage === 1 && POSTS_PER_PAGE > FEED_FIRST_SCREEN_COUNT;

        if (splitFirst) {
          const pageFirstPerfMark = devPerfStart();
          const first = await buildPostsQuery().range(
            0,
            FEED_FIRST_SCREEN_COUNT - 1
          );
          if (gen !== feedFetchGeneration.current) return;
          if (first.error) {
            if (
              publishedAtAvailable &&
              isMissingPublishedAtColumnError(first.error)
            ) {
              setPublishedAtAvailable(false);
              return;
            }
            if (
              feedCountersAvailable &&
              isMissingFeedCounterColumnError(first.error)
            ) {
              setFeedCountersAvailable(false);
              return;
            }
            throw first.error;
          }
          const raw1 = (first.data ?? []) as unknown as RawCommunityPostRow[];
          const normalized1 = normalizeRawPostRows(raw1);
          const firstScreenPosts = toLightweightFeedPosts(normalized1);
          if (gen !== feedFetchGeneration.current) return;
          const total = first.count ?? 0;
          setTotalCount(total);
          commitPostsToState(firstScreenPosts);
          devPerfEnd("communityFeed:page1:first3", pageFirstPerfMark);
          setPostsLoading(false);
          if (total <= FEED_FIRST_SCREEN_COUNT) {
            return;
          }
          setFeedLoadingMore(true);
          if (gen !== feedFetchGeneration.current) {
            setFeedLoadingMore(false);
            return;
          }
          const second = await buildPostsQuery().range(
            FEED_FIRST_SCREEN_COUNT,
            POSTS_PER_PAGE - 1
          );
          if (gen !== feedFetchGeneration.current) {
            setFeedLoadingMore(false);
            return;
          }
          if (second.error) {
            if (
              publishedAtAvailable &&
              isMissingPublishedAtColumnError(second.error)
            ) {
              setPublishedAtAvailable(false);
              setFeedLoadingMore(false);
              return;
            }
            if (
              feedCountersAvailable &&
              isMissingFeedCounterColumnError(second.error)
            ) {
              setFeedCountersAvailable(false);
              setFeedLoadingMore(false);
              return;
            }
            throw second.error;
          }
          const raw2 = (second.data ?? []) as unknown as RawCommunityPostRow[];
          const mergedNormalized = normalizeRawPostRows([...raw1, ...raw2]);
          const enrichedAll = await enrichNormalizedCommunityPosts(
            mergedNormalized,
            enrichOptions
          );
          if (gen !== feedFetchGeneration.current) {
            setFeedLoadingMore(false);
            return;
          }
          commitPostsToState(enrichedAll);
          devPerfEnd("communityFeed:page1:full", pageFirstPerfMark);
          setFeedLoadingMore(false);
          return;
        }

        const pageFetchPerfMark = effectivePage > 1 ? devPerfStart() : null;
        const q = buildPostsQuery().range(from, to);
        const { data, error, count } = await q;

        if (error) {
          if (publishedAtAvailable && isMissingPublishedAtColumnError(error)) {
            setPublishedAtAvailable(false);
            return;
          }
          if (feedCountersAvailable && isMissingFeedCounterColumnError(error)) {
            setFeedCountersAvailable(false);
            return;
          }
          throw error;
        }
        setTotalCount(count ?? 0);

        const rows = (data ?? []) as unknown as RawCommunityPostRow[];
        const normalized = normalizeRawPostRows(rows);
        const enriched = await enrichNormalizedCommunityPosts(
          normalized,
          enrichOptions
        );
        commitPostsToState(enriched);
        if (pageFetchPerfMark) {
          devPerfEnd("communityFeed:pageN:load", pageFetchPerfMark);
        }
      } finally {
        devPerfEnd("communityFeed:loadPosts", perfMark);
      }
    },
    [
      page,
      filterSlug,
      categories,
      readFilter,
      feedCountersAvailable,
      publishedAtAvailable,
      canPreviewScheduledPosts,
      commitPostsToState,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setFeedBootstrapOk(false);
    void (async () => {
      try {
        const session = await resolveSupabaseBrowserSession();
        if (!session?.user) {
          if (!cancelled) {
            router.replace(
              buildLoginUrl(`${pathname}${window.location.search}`)
            );
          }
          return;
        }

        if (!cancelled) setCommunityAuthUserId(session.user.id);
        let resolvedViewerIsAdmin: boolean | null = null;
        try {
          const { data: me } = await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle();
          if (!cancelled) {
            const isAdmin = (me?.role as string | null) === "admin";
            resolvedViewerIsAdmin = isAdmin;
            setViewerIsAdmin(isAdmin);
            if (!isAdmin) {
              const coachPath = coachCommunityPathFromAdminPath(pathname);
              if (coachPath) {
                const query = searchParamsRef.current.toString();
                router.replace(
                  query ? `${coachPath}?${query}` : coachPath
                );
                return;
              }
            }
          }
        } catch {
          if (!cancelled) {
            resolvedViewerIsAdmin = pathname.startsWith("/admin");
            setViewerIsAdmin(resolvedViewerIsAdmin);
          }
        }

        try {
          const uid =
            coachPersonaForCommunity(
              pathname,
              impersonatingCoachId,
              resolvedViewerIsAdmin
            ) ?? session.user.id;
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

        if (!cancelled) setFeedBootstrapOk(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `searchParams` is intentionally read via `searchParamsRef` so opening or
    // closing a post (which only changes ?post=) does not re-run bootstrap and
    // trigger a full feed reload.
  }, [impersonatingCoachId, loadCategories, pathname, router]);

  useEffect(() => {
    if (!feedBootstrapOk) return;
    let cancelled = false;
    setPostsLoading(true);
    setLoadError(null);
    void (async () => {
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
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    feedBootstrapOk,
    page,
    filterSlug,
    readFilter,
    loadPosts,
    postsRefreshNonce,
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / POSTS_PER_PAGE));

  const feedRangeLabel = useMemo(() => {
    if (totalCount === 0) return "0 of 0";
    const start = (page - 1) * POSTS_PER_PAGE + 1;
    const end = Math.min(page * POSTS_PER_PAGE, totalCount);
    return `${start}-${end} of ${totalCount.toLocaleString()}`;
  }, [page, totalCount]);

  const pageNumbers = useMemo(
    () => paginationItems(page, totalPages),
    [page, totalPages]
  );

  const sparseQuote = useMemo(() => {
    const i = sparseEncouragementQuoteIndex(
      page,
      `${filterSlug}:${readFilter}`,
      COMMUNITY_SPARSE_QUOTES.length
    );
    return COMMUNITY_SPARSE_QUOTES[i] ?? COMMUNITY_SPARSE_QUOTES[0];
  }, [page, filterSlug, readFilter]);

  const selectedPost = useMemo(() => {
    const fromList = posts.find((p) => p.id === selectedPostId);
    if (fromList) return fromList;
    if (fetchedDetailPost?.id === selectedPostId) return fetchedDetailPost;
    return null;
  }, [posts, selectedPostId, fetchedDetailPost]);

  /**
   * Optimistically patches a single post already in local state (and the
   * deep-linked detail post) without refetching the whole feed. Used for likes
   * and comments so the UI updates instantly; the authoritative counts are
   * reconciled the next time the feed is loaded.
   */
  const patchPostInState = useCallback(
    (
      postId: string,
      patch: (post: CommunityPostRow) => Partial<CommunityPostRow>
    ) => {
      setPosts((prev) => {
        const next = prev.map((p) => {
          if (p.id !== postId) return p;
          const updated = { ...p, ...patch(p) };
          mergeFeedEngagementOverride(
            feedEngagementOverridesRef.current,
            postId,
            pickFeedEngagementOverride(updated)
          );
          return updated;
        });
        return applyFeedEngagementOverrides(
          next,
          feedEngagementOverridesRef.current
        );
      });
      setFetchedDetailPost((prev) => {
        if (!prev || prev.id !== postId) return prev;
        const updated = { ...prev, ...patch(prev) };
        selectedPostEngagementRef.current = updated;
        return updated;
      });
    },
    []
  );

  useEffect(() => {
    selectedPostEngagementRef.current = selectedPost;
  }, [selectedPost]);

  const closeDetail = useCallback(() => {
    const snap = selectedPostEngagementRef.current;
    if (snap) {
      mergeFeedEngagementOverride(
        feedEngagementOverridesRef.current,
        snap.id,
        pickFeedEngagementOverride(snap)
      );
      patchPostInState(snap.id, () => pickFeedEngagementOverride(snap));
      markPostRead(snap.id);
      if (snap.last_comment_at) {
        markCommentsSeenUpTo(snap.id, snap.last_comment_at);
      }
    }
    setSelectedPostId(null);
    setFetchedDetailPost(null);
    selectedPostEngagementRef.current = null;
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    sp.delete("post");
    const q = sp.toString();
    window.history.replaceState(null, "", q ? `${pathname}?${q}` : pathname);
  }, [markCommentsSeenUpTo, markPostRead, patchPostInState, pathname]);

  const displayedPosts = useMemo(() => {
    if (readFilter === "all" || readFilter === "favourites") return posts;
    return posts.filter((p) =>
      readFilter === "unread"
        ? isCommunityPostUnreadOnFeed(p, feedLocalSnapshot)
        : !isCommunityPostUnreadOnFeed(p, feedLocalSnapshot)
    );
  }, [posts, readFilter, feedLocalSnapshot]);

  const displayedScheduledPosts = useMemo(() => {
    if (!canPreviewScheduledPosts) return [] as CommunityPostRow[];
    return displayedPosts.filter((p) => isFutureScheduledPost(p));
  }, [displayedPosts, canPreviewScheduledPosts]);

  const displayedPublishedPosts = useMemo(() => {
    if (!canPreviewScheduledPosts) return displayedPosts;
    return displayedPosts.filter((p) => !isFutureScheduledPost(p));
  }, [displayedPosts, canPreviewScheduledPosts]);

  useEffect(() => {
    const ids = new Set<string>();
    for (const p of posts) {
      for (const id of extractMentionUserIds(p.body)) ids.add(id);
    }
    const need = [...ids];
    if (need.length === 0) {
      setFeedMentionNameById({});
      return;
    }
    let cancelled = false;
    void fetchCommunityMentionNameMap(need).then((map) => {
      if (!cancelled) setFeedMentionNameById(map);
    });
    return () => {
      cancelled = true;
    };
  }, [posts]);

  const readFilterEmptyOnPage =
    readFilter !== "all" &&
    readFilter !== "favourites" &&
    posts.length > 0 &&
    displayedPublishedPosts.length === 0 &&
    displayedScheduledPosts.length === 0;

  return (
    <>
      <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:justify-start lg:gap-10">
        {communityTab === "map" ? (
          <div className="min-w-0 w-full flex-1 pt-5 lg:pt-6">
            <CommunityMembersMap />
          </div>
        ) : (
            <div className="mx-auto flex min-h-0 w-full max-w-3xl min-w-0 flex-col gap-6 pt-3 lg:mx-0 lg:pt-3.5">
              {loadError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <p className="font-semibold text-rose-900">Community data could not be loaded</p>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white/80 px-3 py-2 font-mono text-xs leading-relaxed text-rose-950 ring-1 ring-rose-100">
                    {loadError}
                  </pre>
                  <p className="mt-2 text-xs text-rose-700/90">
                    {loadError.includes("No active session") ? (
                      <>
                        This is an auth/session issue, not an empty feed. Sign in from this browser tab,
                        or open Community from the same origin you used to log in (not a stale bookmark
                        or preview URL).
                      </>
                    ) : (
                      <>
                        An empty feed does not produce this screen—the Supabase request returned an error.
                        Use the message above (often “relation does not exist” = run the migration, or RLS =
                        check profiles.role is coach or admin).
                      </>
                    )}
                  </p>
                </div>
              ) : null}
              {composeOpen ? (
                <button
                  type="button"
                  aria-label="Close composer overlay"
                  onClick={() => setComposeOpen(false)}
                  className="fixed inset-0 z-40 cursor-default bg-black/45"
                />
              ) : null}

              <div className={composeOpen ? "relative z-50" : undefined}>
                {composeOpen ? (
                  <CreatePostModal
                    categories={visibleCategories}
                    avatarUrl={composeAvatarUrl}
                    authorLabel="You"
                    onClose={() => setComposeOpen(false)}
                    viewerIsAdmin={viewerIsAdmin}
                    onMarkPostRead={markPostReadWithRetry}
                    onCreated={() => {
                      setComposeOpen(false);
                      setPage(1);
                      setPostsRefreshNonce((n) => n + 1);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setComposeOpen(true)}
                    disabled={Boolean(loadError) || visibleCategories.length === 0}
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
                    <span className="min-w-0 flex-1 text-base text-slate-500">Write something…</span>
                  </button>
                )}
              </div>

              {calendarLiveOccurrence ? (
                <button
                  type="button"
                  onClick={() => setSelectedCalendarOccurrence(calendarLiveOccurrence)}
                  className="mt-[-8px] flex w-full items-center justify-center gap-1.5 px-1 py-0 text-center"
                >
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-500 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-white">
                    <span className="h-1 w-1 rounded-full bg-white" />
                    Live
                  </span>
                  <span className="min-w-0 truncate text-[15px] font-semibold text-slate-900">
                    {calendarLiveOccurrence.title}
                  </span>
                  <span className="text-[15px] font-medium text-slate-700">now</span>
                </button>
              ) : calendarNextOccurrence ? (
                <div className="mt-[-8px] flex w-full items-center justify-center gap-1.5 px-1 py-0 text-center text-[15px] text-slate-800">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
                  <span className="min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCalendarOccurrence(calendarNextOccurrence)
                      }
                      className="truncate text-[15px] font-semibold text-slate-900 hover:underline"
                    >
                      {calendarNextOccurrence.title}
                    </button>{" "}
                    is happening{" "}
                    {formatCommunityEventHappeningWhen(
                      calendarNextOccurrence.startsAtIso,
                      calendarNextOccurrence.display_timezone
                    )}
                  </span>
                </div>
              ) : null}

              <div className="relative mb-2 flex items-center">
                <div
                  className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="region"
                  aria-label="Post categories"
                >
                  <div className="flex flex-nowrap items-center gap-2 pr-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterSlug("all");
                        setPage(1);
                      }}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                        filterSlug === "all"
                          ? "bg-sky-700 text-white"
                          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      All
                    </button>
                    {visibleCategories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setFilterSlug(c.slug);
                          setPage(1);
                        }}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                          filterSlug === c.slug
                            ? "bg-sky-700 text-white"
                            : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className="pointer-events-none absolute inset-y-0 right-9 w-5 bg-gradient-to-l from-slate-100 via-slate-100/85 to-transparent"
                  aria-hidden
                />
                <div className="relative z-10 shrink-0" ref={readFilterMenuRef}>
                  <button
                    type="button"
                    aria-expanded={readFilterMenuOpen}
                    aria-haspopup="menu"
                    aria-label={
                      readFilter === "all"
                        ? "Feed filter: all posts"
                        : readFilter === "favourites"
                          ? "Feed filter: favourites"
                          : `Feed filter: ${readFilter}`
                    }
                    onClick={() => setReadFilterMenuOpen((o) => !o)}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
                      readFilter !== "all"
                        ? "bg-sky-50 text-sky-800 ring-2 ring-sky-600"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    <FilterSlidersIcon className="h-4 w-4 shrink-0" />
                  </button>
                  {readFilterMenuOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 z-30 mt-1 min-w-[10.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                    >
                      {(
                        [
                          ["all", "All posts"],
                          ["unread", "Unread"],
                          ["read", "Read"],
                          ["favourites", "Favourites"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="menuitem"
                          className={`flex w-full px-3 py-2 text-left text-sm ${
                            readFilter === value
                              ? "bg-sky-50 font-medium text-sky-900"
                              : "text-slate-800 hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setReadFilter(value);
                            setReadFilterMenuOpen(false);
                            setPage(1);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {loading || (postsLoading && posts.length === 0) ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : readFilter === "favourites" && posts.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No favourite posts yet. Open a thread, tap the menu (⋯), and
                  choose &ldquo;Add to favourites&rdquo;.
                </p>
              ) : readFilterEmptyOnPage ? (
                <p className="text-sm text-slate-500">
                  No {readFilter} posts on this page. Try another page or set
                  the filter to All posts.
                </p>
              ) : (
                <>
                  {canPreviewScheduledPosts && displayedScheduledPosts.length > 0 ? (
                    <section className="mb-1">
                      <button
                        type="button"
                        onClick={() => setScheduledPostsOpen((v) => !v)}
                        className="group flex w-full items-center gap-3 py-1"
                        aria-expanded={scheduledPostsOpen}
                      >
                        <span className="h-px flex-1 bg-slate-200" />
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                          Scheduled posts ({displayedScheduledPosts.length})
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-slate-700">
                          {scheduledPostsOpen ? "Hide" : "Show"}
                        </span>
                        <span className="h-px flex-1 bg-slate-200" />
                      </button>
                      {scheduledPostsOpen ? (
                        <ul className="mt-2 space-y-[1.125rem]">
                          {displayedScheduledPosts.map((post) => (
                            <li key={post.id}>
                              <PostCard
                                post={post}
                                feedMentionNameById={feedMentionNameById}
                                feedCardHasBeenRead={isCommunityPostReadOnFeed(
                                  post,
                                  feedLocalSnapshot
                                )}
                                onOpen={() => openDetail(post.id)}
                                onPostLocalUpdate={patchPostInState}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  ) : null}
                  <ul className="space-y-[1.125rem]">
                    {displayedPublishedPosts.map((post) => (
                      <li key={post.id}>
                        <PostCard
                          post={post}
                          feedMentionNameById={feedMentionNameById}
                          feedCardHasBeenRead={isCommunityPostReadOnFeed(
                            post,
                            feedLocalSnapshot
                          )}
                          onOpen={() => openDetail(post.id)}
                          onPostLocalUpdate={patchPostInState}
                        />
                      </li>
                    ))}
                  </ul>
                  {feedLoadingMore ? (
                    <p className="mt-3 text-center text-xs text-slate-500">
                      Loading more posts…
                    </p>
                  ) : null}
                </>
              )}

              {!loading &&
              !postsLoading &&
              !feedLoadingMore &&
              !loadError &&
              displayedPublishedPosts.length < SPARSE_PAGE_POST_THRESHOLD &&
              !readFilterEmptyOnPage &&
              !(readFilter === "favourites" && posts.length === 0) ? (
                <div className="mx-auto mt-10 max-w-xl px-4 text-center">
                  {displayedPublishedPosts.length === 0 &&
                  displayedScheduledPosts.length === 0 ? (
                    <p className="mb-10 text-sm text-slate-500">
                      No posts yet. Start the conversation.
                    </p>
                  ) : null}
                  <blockquote className="text-xl font-light leading-snug text-slate-800 sm:text-2xl sm:leading-snug">
                    <span className="select-none text-slate-300">&ldquo;</span>
                    {sparseQuote.text}
                    <span className="select-none text-slate-300">&rdquo;</span>
                  </blockquote>
                  <p className="mt-5 text-sm font-medium tracking-wide text-slate-400">
                    {sparseQuote.author}
                  </p>
                  <p className="mx-auto mt-8 max-w-sm text-sm leading-relaxed text-slate-500">
                    Share something useful: a tip, a lesson, or a resource others
                    can use.
                  </p>
                </div>
              ) : null}

              {!loading &&
              !postsLoading &&
              !feedLoadingMore &&
              !loadError &&
              totalPages > 1 ? (
                <nav
                  className="flex flex-col gap-3 rounded-xl bg-[#F9F9F9] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  aria-label="Feed pagination"
                >
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-0.5 rounded-md px-1 py-1 text-sm font-medium text-[#666666] disabled:cursor-not-allowed disabled:text-[#CCCCCC]"
                    >
                      <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                      Previous
                    </button>
                    <div className="flex flex-wrap items-center gap-1 pl-1">
                      {pageNumbers.map((item, idx) =>
                        item === "ellipsis" ? (
                          <span
                            key={`e-${idx}`}
                            className="px-1.5 text-sm text-[#666666]"
                            aria-hidden
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setPage(item)}
                            className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-medium ${
                              item === page
                                ? "bg-[#F9E4B7] text-[#666666]"
                                : "text-[#666666] hover:bg-black/[0.04]"
                            }`}
                            aria-current={item === page ? "page" : undefined}
                          >
                            {item}
                          </button>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="inline-flex items-center gap-0.5 rounded-md px-1 py-1 text-sm font-medium text-[#666666] disabled:cursor-not-allowed disabled:text-[#CCCCCC]"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                    </button>
                  </div>
                  <p className="text-sm text-[#666666] sm:text-right">
                    {feedRangeLabel}
                  </p>
                </nav>
              ) : null}

              {communityTab === "feed" && selectedPost ? (
                <PostDetailModal
                  post={selectedPost}
                  categories={visibleCategories}
                  onClose={closeDetail}
                  onPostsChanged={() => loadPosts()}
                  onPostLocalUpdate={patchPostInState}
                  feedStorageScopeId={feedStorageScopeId}
                  viewerIsAdmin={viewerIsAdmin}
                  onMarkPostRead={markPostRead}
                  onMarkPostUnread={markPostUnread}
                />
              ) : null}
              {selectedCalendarOccurrence ? (
                <CommunityCalendarEventModal
                  occurrence={selectedCalendarOccurrence}
                  onClose={() => setSelectedCalendarOccurrence(null)}
                />
              ) : null}
            </div>
        )}
        {communityTab !== "map" ? (
          <CommunitySidebar
            className={
              communityTab === "feed" ? "pt-3 lg:pt-3.5" : undefined
            }
          />
        ) : null}
      </div>
    </>
  );
}

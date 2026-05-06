"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
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
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { coachPersonaForCommunity } from "@/lib/communityEffectiveAuthorId";
import {
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
import type { CommunityCalendarOccurrence } from "@/lib/communityCalendarTypes";
import { CommunityCalendarEventModal } from "@/components/community/CommunityCalendarEventModal";
import { formatCommunityRelativeFutureLong } from "@/lib/communityRelativeTime";

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
  /** Starred by the signed-in user (auth uid). */
  favourited_by_me: boolean;
  comment_preview_authors: ProfileRow[];
  /** Latest comment `created_at` in this thread, or null if there are no comments. */
  last_comment_at: string | null;
};

type RawCommunityPostRow = Omit<
  CommunityPostRow,
  | "category"
  | "author"
  | "like_count"
  | "comment_count"
  | "liked_by_me"
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
  const uid = user?.id;

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

  const [favRes, myLikesRes, myPollVotesRes] = await Promise.all([
    favPromise,
    myLikesPromise,
    myPollVotesPromise,
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
      favourited_by_me: !favTableMissing && myFavourited.has(row.id),
      poll_voted_option_id: myPollVoteByPostId.get(row.id) ?? null,
      comment_preview_authors: buildCommentPreviewAvatars(thread),
      last_comment_at,
    };
  });
}

function isCommunityPostUnreadOnFeed(
  post: CommunityPostRow,
  snapshot: CommunityFeedLocalState
): boolean {
  if (!snapshot.readPostIds[post.id]) return true;
  const last = post.last_comment_at;
  if (!last) return false;
  const seen = snapshot.commentsSeenUpTo[post.id];
  // Opened the thread but no watermark yet (legacy, or modal closed before
  // comments finished): treat as read for this filter so it matches a dimmed
  // card. New comments after that still flip to unread via last > seen.
  if (!seen) return false;
  return new Date(last).getTime() > new Date(seen).getTime();
}

export function CommunityFeed() {
  const { impersonatingCoachId } = useImpersonation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const communityTab =
    searchParams.get("tab") === "map" ? "map" : "feed";

  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [feedMentionNameById, setFeedMentionNameById] = useState<
    Record<string, string>
  >({});
  const [filterSlug, setFilterSlug] = useState<string | "all">("all");
  const [readFilter, setReadFilter] = useState<
    "all" | "read" | "unread" | "favourites"
  >("all");
  const [readFilterMenuOpen, setReadFilterMenuOpen] = useState(false);
  const readFilterMenuRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [composeAvatarUrl, setComposeAvatarUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [fetchedDetailPost, setFetchedDetailPost] =
    useState<CommunityPostRow | null>(null);
  const [feedBootstrapOk, setFeedBootstrapOk] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [feedCountersAvailable, setFeedCountersAvailable] = useState(true);
  const [publishedAtAvailable, setPublishedAtAvailable] = useState(true);
  const [communityAuthUserId, setCommunityAuthUserId] = useState<
    string | null
  >(null);
  /** Bumps when the feed should reload while staying on the same page (e.g. new post). */
  const [postsRefreshNonce, setPostsRefreshNonce] = useState(0);
  /** Cancels in-flight split-page loads when filters or nonce change. */
  const feedFetchGeneration = useRef(0);
  /** Page 1: after the first few posts, loading the rest of the page. */
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [calendarLiveOccurrence, setCalendarLiveOccurrence] =
    useState<CommunityCalendarOccurrence | null>(null);
  const [calendarNextOccurrence, setCalendarNextOccurrence] =
    useState<CommunityCalendarOccurrence | null>(null);
  const [selectedCalendarOccurrence, setSelectedCalendarOccurrence] =
    useState<CommunityCalendarOccurrence | null>(null);
  const [calendarTick, setCalendarTick] = useState(0);
  const closeDetail = useCallback(() => {
    setSelectedPostId(null);
    setFetchedDetailPost(null);
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
    const id = window.setInterval(() => setCalendarTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void calendarTick;
    let cancelled = false;
    void (async () => {
      const now = DateTime.now();
      const rangeEnd = now.plus({ days: 120 });
      const { data, error } = await supabaseClient
        .from("community_calendar_events")
        .select(
          "id, created_by, title, description, cover_image_url, starts_at, ends_at, display_timezone, location_kind, location_url, is_recurring, recurrence, created_at, updated_at"
        )
        .order("starts_at", { ascending: true });
      if (cancelled || error) return;
      const occurrences = expandCommunityCalendar(
        (data ?? []) as Parameters<typeof expandCommunityCalendar>[0],
        now,
        rangeEnd
      );
      const nowMs = now.toMillis();
      const live =
        occurrences.find((occ) => {
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
        occurrences.find((occ) => {
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
        const { data, error } = await supabaseClient
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
        const enriched = await enrichNormalizedCommunityPosts(normalized);
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
  }, [selectedPostId, posts, feedCountersAvailable]);

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from("community_categories")
      .select("id, slug, label")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    setCategories((data ?? []) as CommunityCategory[]);
  }, []);

  const loadPosts = useCallback(
    async (pageOverride?: number) => {
      feedFetchGeneration.current += 1;
      const gen = feedFetchGeneration.current;
      const perfMark = devPerfStart();
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
            setPosts(dedupePostsById(firstScreenPosts));
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
            const enrichedAll = await enrichNormalizedCommunityPosts(mergedNormalized);
            if (gen !== feedFetchGeneration.current) {
              setFeedLoadingMore(false);
              return;
            }
            setPosts(
              dedupePostsById(
                enrichedAll.map((p) => ({ ...p, favourited_by_me: true as const }))
              )
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
            normalizeRawPostRows(rawPosts)
          );
          setTotalCount(count ?? 0);
          setPosts(
            dedupePostsById(
              enriched.map((p) => ({
                ...p,
                favourited_by_me: true,
              }))
            )
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
          setPosts(dedupePostsById(firstScreenPosts));
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
          const enrichedAll = await enrichNormalizedCommunityPosts(mergedNormalized);
          if (gen !== feedFetchGeneration.current) {
            setFeedLoadingMore(false);
            return;
          }
          setPosts(dedupePostsById(enrichedAll));
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
        const enriched = await enrichNormalizedCommunityPosts(normalized);
        setPosts(dedupePostsById(enriched));
        if (pageFetchPerfMark) {
          devPerfEnd("communityFeed:pageN:load", pageFetchPerfMark);
        }
      } finally {
        devPerfEnd("communityFeed:loadPosts", perfMark);
      }
    },
    [page, filterSlug, categories, readFilter, feedCountersAvailable, publishedAtAvailable]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setFeedBootstrapOk(false);
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session?.user) {
          if (!cancelled) {
            setCommunityAuthUserId(null);
            setLoadError(
              "No active session. Open the app from a logged-in tab, or sign in again and refresh."
            );
          }
          return;
        }

        if (!cancelled) setCommunityAuthUserId(session.user.id);

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

        if (!cancelled) setFeedBootstrapOk(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId, loadCategories, pathname]);

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

  const feedStorageScopeId =
    coachPersonaForCommunity(pathname, impersonatingCoachId) ??
    communityAuthUserId;

  const {
    snapshot: feedLocalSnapshot,
    markPostRead,
    markPostUnread,
    markCommentsSeenUpTo,
  } = useCommunityFeedCardLocalState(feedStorageScopeId);

  const displayedPosts = useMemo(() => {
    if (readFilter === "all" || readFilter === "favourites") return posts;
    return posts.filter((p) =>
      readFilter === "unread"
        ? isCommunityPostUnreadOnFeed(p, feedLocalSnapshot)
        : !isCommunityPostUnreadOnFeed(p, feedLocalSnapshot)
    );
  }, [posts, readFilter, feedLocalSnapshot]);

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
    displayedPosts.length === 0;

  return (
    <>
      <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:justify-start lg:gap-10">
        {communityTab === "map" ? (
          <div className="min-w-0 w-full flex-1 pt-5 lg:pt-6">
            <CommunityMembersMap />
          </div>
        ) : (
            <div className="mx-auto flex min-h-0 w-full max-w-3xl min-w-0 flex-col gap-6 pt-5 lg:mx-0 lg:pt-6">
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
                    categories={categories}
                    avatarUrl={composeAvatarUrl}
                    authorLabel="You"
                    onClose={() => setComposeOpen(false)}
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
                    disabled={Boolean(loadError) || categories.length === 0}
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
                    is happening in{" "}
                    {formatCommunityRelativeFutureLong(
                      calendarNextOccurrence.startsAtIso
                    )}
                  </span>
                </div>
              ) : null}

              <div className="mb-2 flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSlug("all");
                      setPage(1);
                    }}
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
                      onClick={() => {
                        setFilterSlug(c.slug);
                        setPage(1);
                      }}
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
                <div className="relative shrink-0 pt-0.5" ref={readFilterMenuRef}>
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
                    <ListFilter
                      className="h-4 w-4 shrink-0"
                      strokeWidth={2}
                      aria-hidden
                    />
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
                  <ul className="space-y-[1.125rem]">
                    {displayedPosts.map((post) => (
                      <li key={post.id}>
                        <PostCard
                          post={post}
                          feedMentionNameById={feedMentionNameById}
                          feedCardHasBeenRead={Boolean(
                            feedLocalSnapshot.readPostIds[post.id]
                          )}
                          commentsSeenWatermarkIso={
                            feedLocalSnapshot.commentsSeenUpTo[post.id] ?? null
                          }
                          onOpen={() => openDetail(post.id)}
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
              posts.length < SPARSE_PAGE_POST_THRESHOLD &&
              !readFilterEmptyOnPage &&
              !(readFilter === "favourites" && posts.length === 0) ? (
                <div className="mx-auto mt-10 max-w-xl px-4 text-center">
                  {posts.length === 0 ? (
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
                  categories={categories}
                  onClose={closeDetail}
                  onPostsChanged={() => loadPosts()}
                  feedStorageScopeId={feedStorageScopeId}
                  onMarkPostRead={markPostRead}
                  onMarkPostUnread={markPostUnread}
                  onMarkCommentsSeenUpTo={markCommentsSeenUpTo}
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
              communityTab === "feed" ? "pt-5 lg:pt-6" : undefined
            }
          />
        ) : null}
      </div>
    </>
  );
}

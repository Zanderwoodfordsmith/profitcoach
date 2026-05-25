"use client";

import { supabaseClient } from "@/lib/supabaseClient";
import {
  enrichRawCommunityPostRows,
  type CommunityPostRow,
  type RawCommunityPostRow,
} from "@/components/community/CommunityFeed";
import {
  dismissWinsQueueForSession,
  isWinsQueueCheckedThisSession,
  isWinsQueueDismissedThisSession,
  markWinsQueueCheckedThisSession,
} from "@/lib/adminWinsReplyQueueSession";

const LAST_SESSION_KEY_PREFIX = "community:admin:lastSessionEndedAt";
const PERMANENTLY_SKIPPED_KEY_PREFIX = "community:admin:winsQueue:permanentlySkipped";

export {
  dismissWinsQueueForSession,
  isWinsQueueCheckedThisSession,
  isWinsQueueDismissedThisSession,
  markWinsQueueCheckedThisSession,
};

const WINS_ROLLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const WINS_CATEGORY_SLUG = "wins";

const communityCategoryIdCache = new Map<string, string | null>();

export async function resolveCommunityCategoryId(
  slug: string
): Promise<string | null> {
  if (communityCategoryIdCache.has(slug)) {
    return communityCategoryIdCache.get(slug) ?? null;
  }
  const { data, error } = await supabaseClient
    .from("community_categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  const id = data?.id ?? null;
  communityCategoryIdCache.set(slug, id);
  return id;
}

async function resolveWinsCategoryId(): Promise<string | null> {
  return resolveCommunityCategoryId(WINS_CATEGORY_SLUG);
}

function joinedCategorySlug(
  category:
    | { slug: string }
    | { slug: string }[]
    | null
    | undefined
): string | null {
  if (!category) return null;
  const row = Array.isArray(category) ? category[0] : category;
  return row?.slug ?? null;
}

function isWinsCategoryPost(category: Parameters<typeof joinedCategorySlug>[0]): boolean {
  return joinedCategorySlug(category) === WINS_CATEGORY_SLUG;
}

const WINS_POST_SELECT = `
  id,
  title,
  body,
  image_url,
  media,
  is_pinned,
  published_at,
  created_at,
  category_id,
  author_id,
  feed_comment_count,
  feed_like_count,
  feed_poll_vote_count,
  last_comment_at,
  category:community_categories!category_id ( id, slug, label ),
  author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
`;

const WINS_POST_SELECT_LEGACY = `
  id,
  title,
  body,
  image_url,
  media,
  is_pinned,
  published_at,
  created_at,
  category_id,
  author_id,
  feed_poll_vote_count,
  category:community_categories!category_id ( id, slug, label ),
  author:profiles!author_id ( id, full_name, first_name, last_name, avatar_url, role )
`;

type WinPostRow = {
  id: string;
  author_id: string;
  published_at: string | null;
  created_at: string;
};

function lastSessionStorageKey(adminUserId: string): string {
  return `${LAST_SESSION_KEY_PREFIX}:${adminUserId}`;
}

export function loadLastSessionEndedAt(adminUserId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(lastSessionStorageKey(adminUserId));
}

export function persistLastSessionEndedAt(adminUserId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    lastSessionStorageKey(adminUserId),
    new Date().toISOString()
  );
}

function permanentlySkippedStorageKey(adminUserId: string): string {
  return `${PERMANENTLY_SKIPPED_KEY_PREFIX}:${adminUserId}`;
}

export function loadPermanentlySkippedWinPostIds(
  adminUserId: string
): Set<string> {
  if (typeof window === "undefined") return new Set();
  const raw = window.localStorage.getItem(
    permanentlySkippedStorageKey(adminUserId)
  );
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is string => typeof id === "string" && id.length > 0)
    );
  } catch {
    return new Set();
  }
}

/** This admin chose not to celebrate a win (e.g. miscategorized post). */
export function permanentlySkipWinPost(
  adminUserId: string,
  postId: string
): void {
  if (typeof window === "undefined") return;
  const skipped = loadPermanentlySkippedWinPostIds(adminUserId);
  skipped.add(postId);
  window.localStorage.setItem(
    permanentlySkippedStorageKey(adminUserId),
    JSON.stringify([...skipped])
  );
}

/** Earliest `published_at` to fetch (superset for 30d OR since-last-session OR). */
export function getWinsQueryCutoffIso(lastSessionEndedAt: string | null): string {
  const rollingCutoff = Date.now() - WINS_ROLLING_WINDOW_MS;
  if (!lastSessionEndedAt) {
    return new Date(rollingCutoff).toISOString();
  }
  const lastMs = new Date(lastSessionEndedAt).getTime();
  if (Number.isNaN(lastMs)) {
    return new Date(rollingCutoff).toISOString();
  }
  return new Date(Math.min(rollingCutoff, lastMs)).toISOString();
}

/** When `published_at` is missing or stale, fall back to `created_at` (CSV imports). */
export function effectiveWinPostTimeMs(
  publishedAt: string | null,
  createdAt: string
): number {
  const createdMs = new Date(createdAt).getTime();
  const publishedMs = publishedAt ? new Date(publishedAt).getTime() : Number.NaN;
  if (Number.isNaN(publishedMs) && Number.isNaN(createdMs)) return Number.NaN;
  if (Number.isNaN(publishedMs)) return createdMs;
  if (Number.isNaN(createdMs)) return publishedMs;
  return Math.max(publishedMs, createdMs);
}

export function isWinPostEligible(
  publishedAt: string | null,
  createdAt: string,
  lastSessionEndedAt: string | null
): boolean {
  const atMs = effectiveWinPostTimeMs(publishedAt, createdAt);
  if (Number.isNaN(atMs)) return false;
  if (atMs > Date.now()) return false;

  if (atMs >= Date.now() - WINS_ROLLING_WINDOW_MS) {
    return true;
  }
  if (!lastSessionEndedAt) return false;
  const lastMs = new Date(lastSessionEndedAt).getTime();
  if (Number.isNaN(lastMs)) return false;
  return atMs > lastMs;
}

function isMissingFeedCounterColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  return (
    maybe.code === "42703" &&
    typeof maybe.message === "string" &&
    (maybe.message.includes("feed_comment_count") ||
      maybe.message.includes("feed_like_count"))
  );
}

export function isWinPostVisibleNow(
  publishedAt: string | null,
  createdAt: string
): boolean {
  const atMs = effectiveWinPostTimeMs(publishedAt, createdAt);
  return !Number.isNaN(atMs) && atMs <= Date.now();
}

async function fetchWinPostRows(winsCategoryId: string): Promise<WinPostRow[]> {
  const runQuery = (select: string) =>
    supabaseClient
      .from("community_posts")
      .select(select)
      .eq("category_id", winsCategoryId)
      .order("created_at", { ascending: true });

  let res = await runQuery(WINS_POST_SELECT.trim());
  if (res.error && isMissingFeedCounterColumnError(res.error)) {
    res = await runQuery(WINS_POST_SELECT_LEGACY.trim());
  }
  if (res.error) throw res.error;

  const rows = (res.data ?? []) as unknown as WinPostRow[];
  return rows.filter((row) =>
    isWinPostVisibleNow(row.published_at, row.created_at)
  );
}

export async function fetchUserCommentedPostIds(
  userId: string,
  postIds: string[]
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data, error } = await supabaseClient
    .from("community_post_comments")
    .select("post_id")
    .eq("author_id", userId)
    .in("post_id", postIds);
  if (error) throw error;
  return new Set((data ?? []).map((r: { post_id: string }) => r.post_id));
}

export async function fetchPendingAdminWinsQueue(
  adminUserId: string
): Promise<CommunityPostRow[]> {
  const winsCategoryId = await resolveWinsCategoryId();
  if (!winsCategoryId) return [];

  const lastSessionEndedAt = loadLastSessionEndedAt(adminUserId);

  const candidates = await fetchWinPostRows(winsCategoryId);
  const eligible = candidates.filter((row) =>
    isWinPostEligible(row.published_at, row.created_at, lastSessionEndedAt)
  );

  if (eligible.length === 0) return [];

  const postIds = eligible.map((r) => r.id);
  const commented = await fetchUserCommentedPostIds(adminUserId, postIds);
  const permanentlySkipped = loadPermanentlySkippedWinPostIds(adminUserId);
  const pendingIds = eligible
    .filter(
      (row) => !commented.has(row.id) && !permanentlySkipped.has(row.id)
    )
    .map((row) => row.id);

  if (pendingIds.length === 0) return [];

  const pendingIdSet = new Set(pendingIds);

  const runFullQuery = (select: string) =>
    supabaseClient
      .from("community_posts")
      .select(select)
      .eq("category_id", winsCategoryId)
      .in("id", pendingIds)
      .order("created_at", { ascending: true });

  let fullRes = await runFullQuery(WINS_POST_SELECT.trim());
  if (fullRes.error && isMissingFeedCounterColumnError(fullRes.error)) {
    fullRes = await runFullQuery(WINS_POST_SELECT_LEGACY.trim());
  }
  if (fullRes.error) throw fullRes.error;

  const rawRows = (fullRes.data ?? []) as unknown as RawCommunityPostRow[];
  const pendingRaw = rawRows.filter(
    (row) => pendingIdSet.has(row.id) && isWinsCategoryPost(row.category)
  );

  if (pendingRaw.length === 0) return [];

  const enriched = await enrichRawCommunityPostRows(pendingRaw, {
    includeLadderLevel: false,
  });

  const order = new Map(pendingIds.map((id, i) => [id, i]));
  enriched.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  );
  return enriched.filter((post) => post.category?.slug === WINS_CATEGORY_SLUG);
}

/** Same eligibility window as the queue (for notification bell). */
export function isWinNotificationEligible(
  publishedAt: string | null,
  createdAt: string,
  adminUserId: string
): boolean {
  return isWinPostEligible(
    publishedAt,
    createdAt,
    loadLastSessionEndedAt(adminUserId)
  );
}

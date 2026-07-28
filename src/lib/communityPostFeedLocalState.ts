"use client";

import { useCallback, useMemo, useState } from "react";

const STORAGE_PREFIX = "profitCoach.community.feedState.v1";

export type CommunityFeedLocalState = {
  readPostIds: Record<string, true>;
  /** Explicitly marked unread; overrides read ids and engagement-as-read. */
  unreadPostIds: Record<string, true>;
  /** Max comment `created_at` (ISO) the user has seen in the thread for that post. */
  commentsSeenUpTo: Record<string, string>;
};

export type CommunityPostViewerEngagement = {
  commented_by_me?: boolean;
  liked_by_me?: boolean;
  poll_voted_option_id?: string | null;
};

/** Server-side signals that the viewer already engaged with this post. */
export function communityPostHasViewerEngagement(
  post: CommunityPostViewerEngagement
): boolean {
  return Boolean(
    post.commented_by_me || post.liked_by_me || post.poll_voted_option_id
  );
}

export function isCommunityPostReadOnFeed(
  post: CommunityPostViewerEngagement & { id: string },
  snapshot: CommunityFeedLocalState
): boolean {
  // Explicit unread always wins (including over likes/comments).
  if (snapshot.unreadPostIds?.[post.id]) return false;
  return (
    Boolean(snapshot.readPostIds[post.id]) ||
    communityPostHasViewerEngagement(post)
  );
}

function emptyState(): CommunityFeedLocalState {
  return { readPostIds: {}, unreadPostIds: {}, commentsSeenUpTo: {} };
}

function storageKey(scopeId: string): string {
  return `${STORAGE_PREFIX}:${scopeId}`;
}

export function loadCommunityFeedLocalState(
  scopeId: string
): CommunityFeedLocalState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(storageKey(scopeId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<CommunityFeedLocalState>;
    return {
      readPostIds:
        parsed.readPostIds && typeof parsed.readPostIds === "object"
          ? parsed.readPostIds
          : {},
      unreadPostIds:
        parsed.unreadPostIds && typeof parsed.unreadPostIds === "object"
          ? parsed.unreadPostIds
          : {},
      commentsSeenUpTo:
        parsed.commentsSeenUpTo &&
        typeof parsed.commentsSeenUpTo === "object"
          ? parsed.commentsSeenUpTo
          : {},
    };
  } catch {
    return emptyState();
  }
}

function persistCommunityFeedLocalState(
  scopeId: string,
  next: CommunityFeedLocalState
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(scopeId), JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

function maxIso(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export type MarkCommunityPostReadOptions = {
  /**
   * When true, clears an explicit "mark as unread" and marks the post read.
   * Default false so casual auto-read (modal effects, close, engagement) cannot
   * undo a deliberate unread.
   */
  clearExplicitUnread?: boolean;
};

export function markCommunityPostReadInStorage(
  scopeId: string,
  postId: string,
  options?: MarkCommunityPostReadOptions
): boolean {
  const prev = loadCommunityFeedLocalState(scopeId);
  const hadUnread = Boolean(prev.unreadPostIds[postId]);
  if (hadUnread && !options?.clearExplicitUnread) return false;
  if (prev.readPostIds[postId] && !hadUnread) return false;
  const unreadPostIds = { ...prev.unreadPostIds };
  if (hadUnread) delete unreadPostIds[postId];
  persistCommunityFeedLocalState(scopeId, {
    ...prev,
    readPostIds: { ...prev.readPostIds, [postId]: true },
    unreadPostIds,
  });
  return true;
}

/** Marks feed posts authored by `scopeId` as read (author's own posts). */
export function markOwnCommunityPostsReadInStorage(
  scopeId: string,
  posts: { id: string; author?: { id?: string | null } | null }[]
): boolean {
  const prev = loadCommunityFeedLocalState(scopeId);
  let changed = false;
  const readPostIds = { ...prev.readPostIds };
  for (const post of posts) {
    if (
      post.author?.id !== scopeId ||
      readPostIds[post.id] ||
      prev.unreadPostIds[post.id]
    ) {
      continue;
    }
    readPostIds[post.id] = true;
    changed = true;
  }
  if (!changed) return false;
  persistCommunityFeedLocalState(scopeId, {
    ...prev,
    readPostIds,
  });
  return true;
}

/** Marks posts the viewer engaged with (comment, like, poll vote) as read in localStorage. */
export function markEngagedCommunityPostsReadInStorage(
  scopeId: string,
  posts: (CommunityPostViewerEngagement & { id: string })[]
): boolean {
  const prev = loadCommunityFeedLocalState(scopeId);
  let changed = false;
  const readPostIds = { ...prev.readPostIds };
  for (const post of posts) {
    if (
      readPostIds[post.id] ||
      prev.unreadPostIds[post.id] ||
      !communityPostHasViewerEngagement(post)
    ) {
      continue;
    }
    readPostIds[post.id] = true;
    changed = true;
  }
  if (!changed) return false;
  persistCommunityFeedLocalState(scopeId, {
    ...prev,
    readPostIds,
  });
  return true;
}

export function markCommunityPostUnreadInStorage(
  scopeId: string,
  postId: string
): boolean {
  const prev = loadCommunityFeedLocalState(scopeId);
  const alreadyUnread = Boolean(prev.unreadPostIds[postId]);
  const hadRead = Boolean(prev.readPostIds[postId]);
  const hadSeen = postId in prev.commentsSeenUpTo;
  if (alreadyUnread && !hadRead && !hadSeen) return false;
  const readPostIds = { ...prev.readPostIds };
  delete readPostIds[postId];
  const commentsSeenUpTo = { ...prev.commentsSeenUpTo };
  delete commentsSeenUpTo[postId];
  persistCommunityFeedLocalState(scopeId, {
    ...prev,
    readPostIds,
    unreadPostIds: { ...prev.unreadPostIds, [postId]: true },
    commentsSeenUpTo,
  });
  return true;
}

export function markCommunityCommentsSeenInStorage(
  scopeId: string,
  postId: string,
  latestCommentIso: string
): boolean {
  const prev = loadCommunityFeedLocalState(scopeId);
  const existing = prev.commentsSeenUpTo[postId];
  const merged = existing
    ? maxIso(existing, latestCommentIso)
    : latestCommentIso;
  if (existing === merged) return false;
  persistCommunityFeedLocalState(scopeId, {
    ...prev,
    commentsSeenUpTo: { ...prev.commentsSeenUpTo, [postId]: merged },
  });
  return true;
}

export function useCommunityFeedCardLocalState(scopeId: string | null) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const snapshot = useMemo(() => {
    if (!scopeId) return emptyState();
    return loadCommunityFeedLocalState(scopeId);
  }, [scopeId, version]);

  const markPostRead = useCallback(
    (postId: string, options?: MarkCommunityPostReadOptions) => {
      if (!scopeId) return;
      if (markCommunityPostReadInStorage(scopeId, postId, options)) bump();
    },
    [scopeId, bump]
  );

  const markCommentsSeenUpTo = useCallback(
    (postId: string, latestCommentIso: string) => {
      if (!scopeId) return;
      if (
        markCommunityCommentsSeenInStorage(
          scopeId,
          postId,
          latestCommentIso
        )
      ) {
        bump();
      }
    },
    [scopeId, bump]
  );

  const markPostUnread = useCallback(
    (postId: string) => {
      if (!scopeId) return;
      if (markCommunityPostUnreadInStorage(scopeId, postId)) bump();
    },
    [scopeId, bump]
  );

  const markOwnPostsRead = useCallback(
    (posts: { id: string; author?: { id?: string | null } | null }[]) => {
      if (!scopeId) return;
      if (markOwnCommunityPostsReadInStorage(scopeId, posts)) bump();
    },
    [scopeId, bump]
  );

  const markEngagedPostsRead = useCallback(
    (posts: (CommunityPostViewerEngagement & { id: string })[]) => {
      if (!scopeId) return;
      if (markEngagedCommunityPostsReadInStorage(scopeId, posts)) bump();
    },
    [scopeId, bump]
  );

  return {
    snapshot,
    markPostRead,
    markPostUnread,
    markCommentsSeenUpTo,
    markOwnPostsRead,
    markEngagedPostsRead,
  };
}

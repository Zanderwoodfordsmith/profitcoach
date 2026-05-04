"use client";

import { useCallback, useMemo, useState } from "react";

const STORAGE_PREFIX = "profitCoach.community.feedState.v1";

export type CommunityFeedLocalState = {
  readPostIds: Record<string, true>;
  /** Max comment `created_at` (ISO) the user has seen in the thread for that post. */
  commentsSeenUpTo: Record<string, string>;
};

function emptyState(): CommunityFeedLocalState {
  return { readPostIds: {}, commentsSeenUpTo: {} };
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

export function markCommunityPostReadInStorage(
  scopeId: string,
  postId: string
): boolean {
  const prev = loadCommunityFeedLocalState(scopeId);
  if (prev.readPostIds[postId]) return false;
  persistCommunityFeedLocalState(scopeId, {
    ...prev,
    readPostIds: { ...prev.readPostIds, [postId]: true },
  });
  return true;
}

/** Clears read + comment-seen watermarks so the post shows as unread in the feed. */
export function markCommunityPostUnreadInStorage(
  scopeId: string,
  postId: string
): boolean {
  const prev = loadCommunityFeedLocalState(scopeId);
  const hadRead = Boolean(prev.readPostIds[postId]);
  const hadSeen = postId in prev.commentsSeenUpTo;
  if (!hadRead && !hadSeen) return false;
  const readPostIds = { ...prev.readPostIds };
  delete readPostIds[postId];
  const commentsSeenUpTo = { ...prev.commentsSeenUpTo };
  delete commentsSeenUpTo[postId];
  persistCommunityFeedLocalState(scopeId, {
    ...prev,
    readPostIds,
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
    (postId: string) => {
      if (!scopeId) return;
      if (markCommunityPostReadInStorage(scopeId, postId)) bump();
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

  return { snapshot, markPostRead, markPostUnread, markCommentsSeenUpTo };
}

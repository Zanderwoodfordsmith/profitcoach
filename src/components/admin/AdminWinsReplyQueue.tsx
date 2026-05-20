"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MessageSquareOff, X } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  dismissWinsQueueForSession,
  fetchPendingAdminWinsQueue,
  isWinsQueueDismissedThisSession,
  permanentlySkipWinPost,
  persistLastSessionEndedAt,
} from "@/lib/adminWinsReplyQueue";
import { markCommunityWinPostHandled } from "@/lib/communityNotificationReadState";
import {
  markCommunityPostReadInStorage,
  markCommunityPostUnreadInStorage,
} from "@/lib/communityPostFeedLocalState";
import type {
  CommunityCategory,
  CommunityPostRow,
} from "@/components/community/CommunityFeed";
import { PostDetailModal } from "@/components/community/PostDetailModal";

export function AdminWinsReplyQueue() {
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"checking" | "ready">("checking");

  const loadQueue = useCallback(async (uid: string) => {
    const pending = await fetchPendingAdminWinsQueue(uid);
    setPosts(pending);
    setCurrentIndex((idx) =>
      pending.length === 0 ? 0 : Math.min(idx, pending.length - 1)
    );
    if (pending.length > 0 && !isWinsQueueDismissedThisSession()) {
      setOpen(true);
    } else {
      setOpen(false);
    }
    return pending;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setPhase("checking");
      try {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        if (cancelled || !user?.id) {
          return;
        }

        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if ((profile?.role as string | null) !== "admin") {
          if (!cancelled) setPhase("ready");
          return;
        }

        if (cancelled) return;
        setAdminUserId(user.id);

        await loadQueue(user.id);
        if (cancelled) return;

        void supabaseClient
          .from("community_categories")
          .select("id, slug, label")
          .order("sort_order", { ascending: true })
          .then(({ data, error }) => {
            if (!cancelled && !error) {
              setCategories((data ?? []) as CommunityCategory[]);
            }
          });
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("[AdminWinsReplyQueue] load failed", err);
        }
      } finally {
        if (!cancelled) setPhase("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadQueue]);

  useEffect(() => {
    if (!adminUserId) return;

    const persistSession = () => {
      persistLastSessionEndedAt(adminUserId);
    };

    window.addEventListener("beforeunload", persistSession);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        persistSession();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("beforeunload", persistSession);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [adminUserId]);

  const currentPost = posts[currentIndex] ?? null;
  const queueLength = posts.length;

  const handlePostsChanged = useCallback(async () => {
    if (!adminUserId) return;
    const prevId = posts[currentIndex]?.id;
    const pending = await fetchPendingAdminWinsQueue(adminUserId);
    setPosts(pending);
    if (pending.length === 0) {
      setOpen(false);
      setCurrentIndex(0);
      return;
    }
    const prevStillThere = prevId
      ? pending.findIndex((p) => p.id === prevId)
      : -1;
    if (prevStillThere < 0) {
      setCurrentIndex((i) => Math.min(i, pending.length - 1));
    } else {
      setCurrentIndex(prevStillThere);
    }
  }, [adminUserId, currentIndex, posts]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(posts.length - 1, i + 1));
  }, [posts.length]);

  const handleRemindLater = useCallback(() => {
    dismissWinsQueueForSession();
    setOpen(false);
  }, []);

  const handleSkipPermanently = useCallback(async () => {
    if (!adminUserId || !currentPost) return;
    permanentlySkipWinPost(adminUserId, currentPost.id);
    markCommunityWinPostHandled(adminUserId, currentPost.id);
    const pending = await fetchPendingAdminWinsQueue(adminUserId);
    setPosts(pending);
    if (pending.length === 0) {
      setOpen(false);
      setCurrentIndex(0);
      return;
    }
    setCurrentIndex((i) => Math.min(i, pending.length - 1));
  }, [adminUserId, currentPost]);

  const handleClose = useCallback(() => {
    dismissWinsQueueForSession();
    setOpen(false);
  }, []);

  if (phase === "checking") {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        role="status"
        aria-live="polite"
        aria-label="Checking wins to celebrate"
      >
        <p className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-lg">
          Checking wins to celebrate…
        </p>
      </div>
    );
  }

  if (!adminUserId || !open || !currentPost) {
    return null;
  }

  const positionLabel = `${currentIndex + 1} of ${queueLength}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-wins-queue-title"
    >
      <div
        className="flex max-h-[94dvh] w-full max-w-[calc(42rem*1.2)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2
                id="admin-wins-queue-title"
                className="text-lg font-semibold text-slate-900 sm:text-xl"
              >
                Celebrate {queueLength} win{queueLength === 1 ? "" : "s"}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-[min(52vh,28rem)] flex-1 flex-col overflow-hidden">
          <PostDetailModal
            key={currentPost.id}
            post={currentPost}
            categories={categories}
            presentation="embedded"
            onClose={handleClose}
            onPostsChanged={handlePostsChanged}
            feedStorageScopeId={adminUserId}
            onMarkPostRead={(postId) => {
              markCommunityPostReadInStorage(adminUserId, postId);
            }}
            onMarkPostUnread={(postId) => {
              markCommunityPostUnreadInStorage(adminUserId, postId);
            }}
            onMarkCommentsSeenUpTo={() => {}}
          />
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={currentIndex <= 0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous win"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[5rem] text-center text-sm font-medium text-slate-700">
                {positionLabel}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={currentIndex >= queueLength - 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next win"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleSkipPermanently()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                title="Skip this win — no comment needed"
              >
                <MessageSquareOff className="h-4 w-4 shrink-0" aria-hidden />
                No comment needed
              </button>
              <button
                type="button"
                onClick={handleRemindLater}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                title="Close for now; pending wins come back on your next visit"
              >
                <Clock className="h-4 w-4 shrink-0" aria-hidden />
                Remind me later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

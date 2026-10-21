"use client";

import { useSyncExternalStore } from "react";
import { COMMUNITY_ONLINE_WINDOW_MS, isCommunityOnline } from "@/lib/communityPresence";
import { supabaseClient } from "@/lib/supabaseClient";

const POLL_MS = 60_000;

/** One shared poll of who's been seen recently, however many avatars are on the page. */
let lastSeenByUserId: Record<string, string> = {};
const listeners = new Set<() => void>();
let pollId: number | undefined;

async function loadRecent() {
  const since = new Date(Date.now() - COMMUNITY_ONLINE_WINDOW_MS).toISOString();
  const { data, error } = await supabaseClient
    .from("community_presence")
    .select("user_id, last_seen_at")
    .gte("last_seen_at", since);
  if (error) return;
  const next: Record<string, string> = {};
  for (const row of (data ?? []) as { user_id: string; last_seen_at: string }[]) {
    next[row.user_id] = row.last_seen_at;
  }
  lastSeenByUserId = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (pollId === undefined) {
    void loadRecent();
    pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadRecent();
    }, POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && pollId !== undefined) {
      window.clearInterval(pollId);
      pollId = undefined;
    }
  };
}

export function useIsOnline(userId: string | null | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => Boolean(userId) && isCommunityOnline(lastSeenByUserId[userId as string]),
    () => false
  );
}

/** Green dot with a white ring, for the corner of a member's avatar. Place it inside a `relative` box. */
export function OnlineDot({ userId, className = "bottom-0 right-0 h-3 w-3" }: { userId: string | null | undefined; className?: string }) {
  const online = useIsOnline(userId);
  if (!online) return null;
  return (
    <span
      className={`absolute rounded-full border-2 border-white bg-emerald-500 ${className}`}
      title="Online now"
      aria-label="Online now"
    />
  );
}

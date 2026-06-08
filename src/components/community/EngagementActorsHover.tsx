"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileRow } from "@/components/community/CommunityFeed";
import {
  displayNameFromProfile,
  profileInitialsFromProfile,
} from "@/lib/communityProfile";
import {
  fetchCommunityPostCommenters,
  fetchCommunityPostLikers,
} from "@/lib/fetchCommunityPostEngagementActors";

const OPEN_DELAY_MS = 280;
const CLOSE_DELAY_MS = 120;
const MAX_SHOWN = 8;

const actorsCache = new Map<string, ProfileRow[]>();

function ActorAvatar({ profile }: { profile: ProfileRow }) {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-2 ring-white">
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-slate-600">
          {profileInitialsFromProfile(profile)}
        </span>
      )}
    </span>
  );
}

type Props = {
  postId: string;
  kind: "like" | "comment";
  count: number;
  initialAuthors?: ProfileRow[];
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export function EngagementActorsHover({
  postId,
  kind,
  count,
  initialAuthors = [],
  onOpenChange,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [actors, setActors] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchGenRef = useRef(0);

  const cacheKey = `${postId}:${kind}:${count}`;

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  const loadActors = useCallback(async () => {
    if (count <= 0) {
      setActors([]);
      return;
    }

    const cached = actorsCache.get(cacheKey);
    if (cached) {
      setActors(cached);
      return;
    }

    if (initialAuthors.length > 0) {
      setActors(initialAuthors);
    }

    const gen = ++fetchGenRef.current;
    setLoading(true);
    try {
      const profiles =
        kind === "like"
          ? await fetchCommunityPostLikers(postId)
          : await fetchCommunityPostCommenters(postId);
      if (gen !== fetchGenRef.current) return;
      actorsCache.set(cacheKey, profiles);
      setActors(profiles);
    } catch {
      if (gen !== fetchGenRef.current) return;
      if (initialAuthors.length > 0) setActors(initialAuthors);
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [cacheKey, count, initialAuthors, kind, postId]);

  const handleOpen = useCallback(() => {
    clearCloseTimer();
    clearOpenTimer();
    openTimerRef.current = setTimeout(() => {
      setOpenState(true);
      void loadActors();
    }, OPEN_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, loadActors, setOpenState]);

  const handleClose = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpenState(false);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, setOpenState]);

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
      fetchGenRef.current += 1;
      onOpenChange?.(false);
    },
    [clearCloseTimer, clearOpenTimer, onOpenChange]
  );

  if (count <= 0) {
    return <>{children}</>;
  }

  const title = kind === "like" ? "Liked by" : "Commented by";
  const shown = actors.slice(0, MAX_SHOWN);
  const hiddenCount = Math.max(0, actors.length - shown.length);
  const showPanel = open && (loading || shown.length > 0 || hiddenCount > 0);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
    >
      {children}
      {showPanel ? (
        <span
          role="tooltip"
          className="pointer-events-auto absolute bottom-full left-0 z-50 mb-2.5 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          <span
            aria-hidden
            className="block h-1.5 w-full bg-gradient-to-r from-sky-800 via-sky-500 to-sky-300"
          />
          <span className="block px-4 pb-3.5 pt-3">
            <span className="block text-sm font-semibold leading-tight text-slate-800">
              {title}
            </span>
            {loading && shown.length === 0 ? (
              <span className="mt-2.5 block text-sm text-slate-500">Loading…</span>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {shown.map((profile) => (
                  <li
                    key={profile.id}
                    className="flex min-w-0 items-center gap-2.5 text-sm leading-snug text-slate-700"
                  >
                    <ActorAvatar profile={profile} />
                    <span className="truncate font-medium">
                      {displayNameFromProfile(profile)}
                    </span>
                  </li>
                ))}
                {hiddenCount > 0 ? (
                  <li className="pl-10 text-sm font-medium text-slate-500">
                    and {hiddenCount} other{hiddenCount === 1 ? "" : "s"}
                  </li>
                ) : null}
              </ul>
            )}
          </span>
        </span>
      ) : null}
    </span>
  );
}

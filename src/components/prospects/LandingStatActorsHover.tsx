"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLandingStatActors } from "@/lib/fetchLandingStatActors";
import type { LandingActor, LandingStatKind } from "@/lib/landingActors";
import { formatProspectLabel, formatProspectPersonName } from "@/lib/prospectDisplayFormat";
import { supabaseClient } from "@/lib/supabaseClient";

const OPEN_DELAY_MS = 280;
const CLOSE_DELAY_MS = 120;
const MAX_SHOWN = 8;

const TITLES: Record<LandingStatKind, string> = {
  opt_in: "Opted in",
  start: "Started scorecard",
  finish: "Completed",
};

function actorInitials(actor: LandingActor): string {
  const name = formatProspectPersonName(actor.full_name) || actor.email || "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function actorDisplayName(actor: LandingActor): string {
  return (
    formatProspectPersonName(actor.full_name) ||
    formatProspectLabel(actor.business_name) ||
    actor.email ||
    "Prospect"
  );
}

function ActorAvatar({ actor }: { actor: LandingActor }) {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-2 ring-white">
      <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-slate-600">
        {actorInitials(actor)}
      </span>
    </span>
  );
}

type Props = {
  kind: LandingStatKind;
  count: number;
  rangeQuery: string;
  impersonatingCoachId: string | null;
  children: React.ReactNode;
};

export function LandingStatActorsHover({
  kind,
  count,
  rangeQuery,
  impersonatingCoachId,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [actors, setActors] = useState<LandingActor[]>([]);
  const [loading, setLoading] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchGenRef = useRef(0);

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

  const loadActors = useCallback(async () => {
    if (count <= 0) {
      setActors([]);
      return;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session?.access_token) {
      setActors([]);
      return;
    }

    const gen = ++fetchGenRef.current;
    setLoading(true);
    try {
      const profiles = await fetchLandingStatActors(
        kind,
        rangeQuery,
        session.access_token,
        impersonatingCoachId
      );
      if (gen !== fetchGenRef.current) return;
      setActors(profiles);
    } catch {
      if (gen !== fetchGenRef.current) return;
      setActors([]);
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [count, impersonatingCoachId, kind, rangeQuery]);

  const handleOpen = useCallback(() => {
    clearCloseTimer();
    clearOpenTimer();
    openTimerRef.current = setTimeout(() => {
      setOpen(true);
      void loadActors();
    }, OPEN_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, loadActors]);

  const handleClose = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer]);

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
      fetchGenRef.current += 1;
    },
    [clearCloseTimer, clearOpenTimer]
  );

  if (count <= 0) {
    return <>{children}</>;
  }

  const shown = actors.slice(0, MAX_SHOWN);
  const hiddenCount = Math.max(0, actors.length - shown.length);
  const showPanel = open && (loading || shown.length > 0 || hiddenCount > 0);

  return (
    <span
      className="relative block h-full"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
    >
      {children}
      {showPanel ? (
        <span
          role="tooltip"
          className="pointer-events-auto absolute left-0 top-full z-50 mt-2.5 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          <span
            aria-hidden
            className="block h-1.5 w-full bg-gradient-to-r from-sky-800 via-sky-500 to-sky-300"
          />
          <span className="block px-4 pb-3.5 pt-3">
            <span className="block text-sm font-semibold leading-tight text-slate-800">
              {TITLES[kind]}
            </span>
            {loading && shown.length === 0 ? (
              <span className="mt-2.5 block text-sm text-slate-500">Loading…</span>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {shown.map((actor) => (
                  <li
                    key={actor.id}
                    className="flex min-w-0 items-center gap-2.5 text-sm leading-snug text-slate-700"
                  >
                    <ActorAvatar actor={actor} />
                    <span className="min-w-0 truncate font-medium">
                      {actorDisplayName(actor)}
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

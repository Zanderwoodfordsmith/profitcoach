"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export type RecentVisitKind = "lesson" | "resource" | "prospect" | "client";

export type RecentVisit = {
  kind: RecentVisitKind;
  title: string;
  /** Second line: course, resource group, or business name. */
  detail: string | null;
  href: string;
  at: string;
};

const KEY_PREFIX = "pc-recent-visits:";
const MAX_VISITS = 30;
const KINDS = new Set<RecentVisitKind>(["lesson", "resource", "prospect", "client"]);

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function isRecentVisit(value: unknown): value is RecentVisit {
  const v = value as Partial<RecentVisit> | null;
  return (
    typeof v?.title === "string" &&
    typeof v.href === "string" &&
    typeof v.at === "string" &&
    KINDS.has(v.kind as RecentVisitKind)
  );
}

/**
 * Pages this viewer opened on this device, newest first. Lessons come from the
 * server instead (academy_lesson_views), so they follow the coach across devices.
 */
export function readRecentVisits(userId: string): RecentVisit[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isRecentVisit) : [];
  } catch {
    return [];
  }
}

function writeRecentVisit(userId: string, visit: RecentVisit): void {
  try {
    const rest = readRecentVisits(userId).filter((v) => v.href !== visit.href);
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify([visit, ...rest].slice(0, MAX_VISITS))
    );
  } catch {
    /* private mode / quota */
  }
}

/** Remember the current page in the viewer's recents once its title is known. */
export function useRecordRecentVisit(
  visit: {
    kind: Exclude<RecentVisitKind, "lesson">;
    title: string | null | undefined;
    detail?: string | null;
  } | null
): void {
  const pathname = usePathname();
  const kind = visit?.kind ?? null;
  const title = visit?.title?.trim() || null;
  const detail = visit?.detail?.trim() || null;

  useEffect(() => {
    if (!kind || !title || !pathname) return;
    let cancelled = false;
    void supabaseClient.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id;
      if (cancelled || !userId) return;
      writeRecentVisit(userId, {
        kind,
        title,
        detail,
        href: pathname,
        at: new Date().toISOString(),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [kind, title, detail, pathname]);
}

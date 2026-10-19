"use client";

import { useEffect, useState } from "react";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import { lessonPath, type SearchPrefix } from "@/lib/search/paths";
import { readRecentVisits, type RecentVisit } from "@/lib/search/recentVisits";
import type { SearchRecentLesson } from "@/lib/search/types";

const RECENT_LIMIT = 8;

function visitTime(visit: RecentVisit): number {
  const t = Date.parse(visit.at);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * What the viewer opened lately, newest first: lessons from the server (any
 * device) merged with resources, prospects and clients opened on this device.
 * Null until loaded.
 */
export function useSearchRecents(prefix: SearchPrefix): RecentVisit[] | null {
  const [recent, setRecent] = useState<RecentVisit[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const lessons: RecentVisit[] = [];
      try {
        const token = await getValidSupabaseAccessToken();
        if (token) {
          const res = await fetch("/api/search/recent", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const body = (await res.json()) as { lessons?: SearchRecentLesson[] };
            for (const l of body.lessons ?? []) {
              lessons.push({
                kind: "lesson",
                title: l.title,
                detail: l.course_title,
                href: lessonPath(prefix, l.course_id, l.lesson_id),
                at: l.viewed_at,
              });
            }
          }
        }
      } catch {
        /* recents are a convenience; search still works */
      }
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const userId = session?.user.id;
      const local = userId
        ? readRecentVisits(userId).filter((v) => v.href.startsWith(`${prefix}/`))
        : [];
      if (cancelled) return;
      setRecent(
        [...lessons, ...local]
          .sort((a, b) => visitTime(b) - visitTime(a))
          .slice(0, RECENT_LIMIT)
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  return recent;
}

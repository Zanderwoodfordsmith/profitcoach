"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { gridCounts, type GridCoach, type GridCounts } from "@/lib/practiceKnowledge/blueprintGrid";
import { supabaseClient } from "@/lib/supabaseClient";

/** Blueprint numbers per coach id, for the Coaches list. Empty until loaded or when nobody has started. */
export function useBlueprintCounts(enabled: boolean): Map<string, GridCounts> {
  const [counts, setCounts] = useState<Map<string, GridCounts>>(new Map());
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/admin/practice/grid", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json().catch(() => null)) as { coaches?: GridCoach[] } | null;
      if (cancelled || !res.ok || !body?.coaches) return;
      setCounts(new Map(body.coaches.map((coach) => [coach.coach_id, gridCounts(coach)])));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return counts;
}

/** Done, review and to do as one thin bar, with what is waiting on BCA and new comments beside it. */
export function BlueprintMiniBar({ counts }: { counts: GridCounts | undefined }) {
  if (!counts || !counts.tracked) return <span className="text-slate-400">—</span>;
  const pct = (n: number) => `${(n / counts.tracked) * 100}%`;
  const label = `Blueprint: ${counts.done} done, ${counts.review} in review, ${counts.todo} to do${
    counts.bca ? `, ${counts.bca} waiting on BCA` : ""
  }${counts.unread ? `, ${counts.unread} new comment${counts.unread === 1 ? "" : "s"}` : ""}`;
  return (
    <Link href="/admin/client-success/blueprint" title={label} aria-label={label} className="flex items-center gap-1.5">
      <span className="flex h-2 w-16 overflow-hidden rounded-full bg-slate-100">
        <span className="h-full bg-emerald-400" style={{ width: pct(counts.done) }} />
        <span className="h-full bg-amber-300" style={{ width: pct(counts.review) }} />
        <span className="h-full bg-rose-400" style={{ width: pct(counts.todo) }} />
      </span>
      {counts.bca ? (
        <span className="rounded-full bg-[#0c5290] px-1.5 text-[10px] font-bold leading-4 text-white">{counts.bca}</span>
      ) : null}
      {counts.unread ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
          {counts.unread}
        </span>
      ) : null}
    </Link>
  );
}

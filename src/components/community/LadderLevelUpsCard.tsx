"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Trophy, User } from "lucide-react";

import {
  type CommunityLadderEventDTO,
  getLadderLevel,
} from "@/lib/ladder";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

function displayName(e: CommunityLadderEventDTO): string {
  const fromParts = [e.first_name, e.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  if (fromParts) return fromParts;
  const full = e.full_name?.trim();
  if (full) return full;
  return "Member";
}


export function LadderLevelUpsCard() {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const ladderHref = pathname.startsWith("/admin")
    ? "/admin/signature/ladder"
    : "/coach/signature/ladder";
  const [events, setEvents] = useState<CommunityLadderEventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const roleRes = await fetch("/api/profile-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id }),
    });
    const roleBody = (await roleRes.json().catch(() => ({}))) as {
      role?: string;
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (roleBody.role === "admin" && impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const res = await fetch(
      "/api/coach/ladder?eventsLimit=5&eventsOffset=0&kind=level_up",
      { headers }
    );
    if (!res.ok) {
      setEvents([]);
      setLoading(false);
      return;
    }
    const body = (await res.json()) as {
      events?: CommunityLadderEventDTO[];
      migrationNeeded?: boolean;
    };
    setEvents(body.events ?? []);
    setMigrationNeeded(!!body.migrationNeeded);
    setLoading(false);
  }, [impersonatingCoachId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="mt-4 rounded-xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Trophy className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Recent Ladder Level-Ups
        </p>
      </div>

      {migrationNeeded ? (
        <p className="mt-3 text-xs text-slate-500">
          Level-ups will appear here after the latest database migration is
          applied.
        </p>
      ) : loading ? (
        <p className="mt-3 text-xs text-slate-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          No level-ups yet. Set your ladder level on the Profit Coach Ladder
          page.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {events.map((ev) => {
            const lvl = getLadderLevel(ev.to_level);
            const ordinal = lvl?.ordinal ?? 0;
            return (
              <li key={ev.id} className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${lvl?.chipClassName ?? "border border-slate-200 bg-slate-50 text-slate-700"}`}
                  title={lvl?.name ?? ev.to_level}
                >
                  {ordinal || "—"}
                </div>
                <div className="relative h-9 w-9 shrink-0">
                  {ev.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ev.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200 text-slate-400">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-semibold leading-snug text-slate-900">
                    {displayName(ev)}
                  </p>
                  <p className="mt-0.5 truncate text-[0.8125rem] leading-snug text-slate-600">
                    {lvl?.name ?? ev.to_level}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 border-t border-slate-100 pt-3 text-center">
        <Link
          href={ladderHref}
          className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
        >
          See ladder →
        </Link>
      </div>
    </div>
  );
}

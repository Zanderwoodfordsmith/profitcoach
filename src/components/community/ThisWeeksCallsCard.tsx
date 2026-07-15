"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Video } from "lucide-react";
import { DateTime } from "luxon";

import { supabaseClient } from "@/lib/supabaseClient";
import {
  expandCommunityCalendar,
  communityCalendarMondayStart,
} from "@/lib/communityCalendarExpand";
import type {
  CommunityCalendarEventRow,
  CommunityCalendarEventExceptionRow,
  CommunityCalendarOccurrence,
} from "@/lib/communityCalendarTypes";
import {
  COMMUNITY_CALENDAR_EVENT_SELECT,
  COMMUNITY_CALENDAR_EXCEPTION_SELECT,
} from "@/lib/communityCalendarData";
import {
  communityCalendarHasRecording,
  isLiveCommunityCalendarOccurrence,
} from "@/lib/communityCalendarDisplay";
import { defaultCommunityCalendarTimezone } from "@/lib/communityCalendarTimezones";

function formatDayName(dt: DateTime): string {
  return dt.toFormat("cccc");
}

function formatTime(dt: DateTime): string {
  return dt.toFormat("h:mma").toLowerCase();
}

function formatTimeRange(start: DateTime, end: DateTime): string {
  const sameMeridiem = start.toFormat("a") === end.toFormat("a");
  const startStr = sameMeridiem
    ? start.toFormat(start.minute === 0 ? "h" : "h:mm")
    : start.toFormat(start.minute === 0 ? "ha" : "h:mma").toLowerCase();
  const endStr = end
    .toFormat(end.minute === 0 ? "ha" : "h:mma")
    .toLowerCase();
  return `${sameMeridiem ? startStr : startStr} – ${endStr}`;
}

type CallItem = {
  occurrence: CommunityCalendarOccurrence;
  start: DateTime;
  end: DateTime;
  isPast: boolean;
  isLive: boolean;
  hasRecording: boolean;
};

export function ThisWeeksCallsCard() {
  const pathname = usePathname();
  const calendarHref = pathname.startsWith("/admin")
    ? "/admin/community/calendar"
    : "/coach/community/calendar";

  const tz = useMemo(() => defaultCommunityCalendarTimezone(), []);

  const [events, setEvents] = useState<CommunityCalendarEventRow[]>([]);
  const [exceptions, setExceptions] = useState<
    CommunityCalendarEventExceptionRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [evRes, exRes] = await Promise.all([
          supabaseClient
            .from("community_calendar_events")
            .select(COMMUNITY_CALENDAR_EVENT_SELECT)
            .order("starts_at", { ascending: true }),
          supabaseClient
            .from("community_calendar_event_exceptions")
            .select(COMMUNITY_CALENDAR_EXCEPTION_SELECT),
        ]);
        if (cancelled) return;
        setEvents(
          (evRes.data ?? []) as CommunityCalendarEventRow[]
        );
        setExceptions(
          (exRes.data ?? []) as CommunityCalendarEventExceptionRow[]
        );
      } catch {
        /* sidebar card is non-critical */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const calls = useMemo<CallItem[]>(() => {
    void nowTick;
    if (events.length === 0) return [];

    const now = DateTime.now().setZone(tz);
    const monday = communityCalendarMondayStart(now);
    const sunday = monday.plus({ days: 6 }).endOf("day");

    const occurrences = expandCommunityCalendar(
      events,
      monday,
      sunday,
      exceptions
    );

    const active = occurrences.filter((o) => !o.isCancelled);

    return active.map((o) => {
      const start = DateTime.fromISO(o.startsAtIso, { zone: "utc" }).setZone(
        tz
      );
      const end = DateTime.fromISO(o.endsAtIso, { zone: "utc" }).setZone(tz);
      const isPast = end <= now;
      return {
        occurrence: o,
        start,
        end,
        isPast,
        isLive: isLiveCommunityCalendarOccurrence(o),
        hasRecording: communityCalendarHasRecording(o),
      };
    });
  }, [events, exceptions, tz, nowTick]);

  return (
    <div className="mt-4 rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 pt-4 pb-3">
        <CalendarDays
          className="h-4 w-4 shrink-0 text-sky-600"
          aria-hidden
        />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          This Week&rsquo;s Calls
        </p>
      </div>

      <div className="px-4 pb-4">
        {loading ? (
          <p className="mt-3 text-xs text-slate-500">Loading&hellip;</p>
        ) : calls.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            No calls scheduled this week.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {calls.map((c) => {
              const dayNum = c.start.day;
              return (
                <li
                  key={`${c.occurrence.eventId}-${c.occurrence.startsAtIso}`}
                  className="flex items-start gap-3"
                >
                  {/* Calendar date icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none ${
                      c.isLive
                        ? "border-red-200 bg-red-50"
                        : c.isPast
                          ? "border-slate-200 bg-slate-50"
                          : "border-sky-200 bg-sky-50"
                    }`}
                  >
                    <span
                      className={`text-base font-bold tabular-nums leading-none ${
                        c.isLive
                          ? "text-red-600"
                          : c.isPast
                            ? "text-slate-400"
                            : "text-sky-700"
                      }`}
                    >
                      {dayNum}
                    </span>
                  </div>

                  {/* Call info */}
                  <div className="min-w-0 flex-1 pt-px">
                    <p
                      className={`text-[11px] font-medium leading-snug ${
                        c.isPast && !c.isLive
                          ? "text-slate-400"
                          : "text-slate-500"
                      }`}
                    >
                      {formatDayName(c.start)}
                      {" · "}
                      {formatTimeRange(c.start, c.end)}
                    </p>
                    <p
                      className={`truncate text-[0.8125rem] font-semibold leading-snug ${
                        c.isPast && !c.isLive
                          ? "text-slate-400"
                          : "text-slate-900"
                      }`}
                    >
                      {c.occurrence.title}
                    </p>
                    {c.isLive ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-white"
                          aria-hidden
                        />
                        Live now
                      </span>
                    ) : c.isPast && c.hasRecording ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold leading-tight text-emerald-800">
                        <Video
                          className="h-2.5 w-2.5 shrink-0"
                          aria-hidden
                        />
                        Recording available
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-3 text-center">
        <Link
          href={calendarHref}
          className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
        >
          View full calendar &rarr;
        </Link>
      </div>
    </div>
  );
}

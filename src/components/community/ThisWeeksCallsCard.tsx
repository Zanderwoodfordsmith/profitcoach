"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Video, X } from "lucide-react";
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

function formatDayAbbrev(dt: DateTime): string {
  return dt.toFormat("ccc");
}

function formatStartTime(dt: DateTime): string {
  return dt
    .toFormat(dt.minute === 0 ? "ha" : "h:mma")
    .toLowerCase();
}

function formatTimezoneShort(iana: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? iana;
  } catch {
    return iana;
  }
}

function formatTimezoneCity(iana: string): string {
  const city = iana.split("/").pop()?.replaceAll("_", " ");
  return city || iana;
}

type CallItem = {
  occurrence: CommunityCalendarOccurrence;
  start: DateTime;
  end: DateTime;
  isPast: boolean;
  isCancelled: boolean;
  cancellationReason: string | null;
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

    return occurrences.map((o) => {
      const start = DateTime.fromISO(o.startsAtIso, { zone: "utc" }).setZone(
        tz
      );
      const end = DateTime.fromISO(o.endsAtIso, { zone: "utc" }).setZone(tz);
      const isPast = end <= now;
      const reason = o.cancellationReason?.trim() || null;
      return {
        occurrence: o,
        start,
        end,
        isPast,
        isCancelled: Boolean(o.isCancelled),
        cancellationReason: reason,
        isLive: isLiveCommunityCalendarOccurrence(o),
        hasRecording: communityCalendarHasRecording(o),
      };
    });
  }, [events, exceptions, tz, nowTick]);

  const tzShort = useMemo(() => formatTimezoneShort(tz), [tz]);
  const tzCity = useMemo(() => formatTimezoneCity(tz), [tz]);

  return (
    <div className="mt-4 rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 pt-4 pb-3">
        <CalendarDays
          className="h-4 w-4 shrink-0 text-sky-600"
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
          This Week&rsquo;s Calls
        </p>
        <span
          className="shrink-0 text-[10px] font-medium tabular-nums text-slate-400"
          title={`Times shown in ${tzCity} (${tz})`}
        >
          {tzShort}
        </span>
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
              const borderTone = c.isCancelled
                ? "border-[#CC0000]/30"
                : c.isLive
                  ? "border-red-200"
                  : "border-slate-200";
              const timeText = c.isLive
                ? "text-red-600"
                : c.isPast
                  ? "text-slate-400"
                  : "text-slate-500";
              const dayBar = c.isCancelled
                ? "bg-[#CC0000] text-white"
                : c.isLive
                  ? "bg-red-500 text-white"
                  : c.isPast
                    ? "bg-slate-200 text-slate-500"
                    : "bg-sky-600 text-white";

              return (
                <li
                  key={`${c.occurrence.eventId}-${c.occurrence.startsAtIso}`}
                  className="flex items-center gap-3"
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 flex-col overflow-hidden rounded-lg border bg-white text-center leading-none ${borderTone}`}
                    aria-label={
                      c.isCancelled
                        ? `${formatDayAbbrev(c.start)} cancelled`
                        : `${formatDayAbbrev(c.start)} ${formatStartTime(c.start)}`
                    }
                  >
                    <div
                      className={`shrink-0 py-0.5 text-[9px] font-semibold tracking-wide ${dayBar}`}
                    >
                      {formatDayAbbrev(c.start)}
                    </div>
                    <div className="flex min-h-0 flex-1 items-center justify-center px-0.5">
                      {c.isCancelled ? (
                        <X
                          className="h-3.5 w-3.5 text-[#CC0000]"
                          strokeWidth={2.75}
                          aria-hidden
                        />
                      ) : (
                        <span
                          className={`text-[10px] font-medium tabular-nums leading-none ${timeText}`}
                        >
                          {formatStartTime(c.start)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 self-center">
                    <p
                      className={`truncate text-[0.8125rem] font-semibold leading-snug ${
                        c.isPast && !c.isLive && !c.isCancelled
                          ? "text-slate-400"
                          : "text-slate-900"
                      }`}
                    >
                      {c.occurrence.title}
                    </p>
                    {c.isCancelled ? (
                      <p className="mt-0.5 truncate text-[11px] font-medium leading-snug text-[#CC0000]">
                        Cancelled
                        {c.cancellationReason
                          ? `: ${c.cancellationReason}`
                          : null}
                      </p>
                    ) : c.isLive ? (
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
